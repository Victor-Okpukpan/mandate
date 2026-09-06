import "server-only";
import { randomUUID } from "node:crypto";
import { generateAuthorizationSignature, type WalletApiRequestSignatureInput } from "@privy-io/node";
import { getPrivyServerClient } from "./privy";

/**
 * Multi-signer approvals, built on Privy's *documented* direct-call signing mechanism
 * (`authorization_context` on the resource call itself — confirmed live: a quorum-owned wallet's
 * `wallets().update()` succeeds once handed `{authorization_private_keys: [...]}` or
 * `{signatures: [...]}` meeting the quorum's threshold), rather than on `POST
 * /v1/intents/{id}/authorize`.
 *
 * That REST endpoint is real (its request/response shape is documented) but its *signable
 * payload* is not published anywhere as of writing: docs.privy.io's own three relevant pages
 * (`/api-reference/intents/authorize`, `/transaction-management/intents/sign-intents`,
 * `/controls/key-quorum/sign`) each stop short of a worked example for it, and the installed
 * `@privy-io/node@0.34.0` ships the request/response types but no method that calls it. Four
 * payload reconstructions — the intent's own `request_details` verbatim, the actual
 * `PATCH /v1/intents/wallets/{id}` call the SDK issues to create it, and both again with the
 * `privy-request-expiry` header the SDK silently attaches — were built using the SDK's own
 * `generateAuthorizationSignature`/`formatRequestForAuthorizationSignature` (self-verified correct
 * against the paired public key with plain Node `crypto.verify`) and every one was rejected live
 * by Privy's API with `"No valid authorization key found for signature"`. Rather than ship a
 * guessed signature scheme for a security-critical approval endpoint, this module doesn't call it
 * at all. Delete this comment and switch to the real endpoint once Privy ships a worked example or
 * an SDK method.
 *
 * What this DOES use is fully verified live: `wallets().update(id, {authorization_context})`
 * against a quorum-owned wallet. A quorum's `authorization_threshold` can be > 1 and its members
 * sign independently, at different times, from different places — Privy's own docs describe
 * exactly this ("each owner or signer calls the endpoint with their own signature... until the
 * resource's authorization threshold is satisfied") for the intents flow; this module reproduces
 * the same collect-until-threshold shape around the direct-call flow instead. Each signer computes
 * a signature client-adjacent (their raw P-256 authorization private key is sent to this server
 * once, used in-process to sign, and never persisted or logged) over the exact
 * `WalletApiRequestSignatureInput` the eventual real call will use, so the signature they produce
 * is valid for that call by construction.
 *
 * Storage is an in-process `Map` — acceptable for the single-instance deployment this ships on
 * today; a restart drops pending approvals before they're signed. Move to a real store before
 * running more than one web instance.
 */

export type ApprovalAction =
  | { kind: "updateWalletPolicy"; walletId: string; policyIds: string[] }
  | { kind: "updateWalletDisplayName"; walletId: string; displayName: string }
  | { kind: "detachWalletOwner"; walletId: string };

export interface PendingApproval {
  id: string;
  orgEnsName: string;
  quorumId: string;
  threshold: number;
  action: ApprovalAction;
  /** The exact request this approval will issue once threshold signatures are collected. */
  request: { method: "PATCH"; url: string; body: Record<string, unknown> };
  createdAt: number;
  createdBy: string;
  /** One entry per signer who has signed so far — base64 signature only, no key material. */
  signatures: string[];
  status: "pending" | "executed" | "failed";
  error?: string;
}

const store = new Map<string, PendingApproval>();

function actionToRequest(action: ApprovalAction): { method: "PATCH"; url: string; body: Record<string, unknown> } {
  const base = "https://api.privy.io/v1/wallets";
  switch (action.kind) {
    case "updateWalletPolicy":
      return { method: "PATCH", url: `${base}/${action.walletId}`, body: { policy_ids: action.policyIds } };
    case "updateWalletDisplayName":
      return { method: "PATCH", url: `${base}/${action.walletId}`, body: { display_name: action.displayName } };
    case "detachWalletOwner":
      return { method: "PATCH", url: `${base}/${action.walletId}`, body: { owner_id: null } };
  }
}

export function proposeApproval(input: {
  orgEnsName: string;
  quorumId: string;
  threshold: number;
  action: ApprovalAction;
  createdBy: string;
}): PendingApproval {
  const approval: PendingApproval = {
    id: randomUUID(),
    orgEnsName: input.orgEnsName,
    quorumId: input.quorumId,
    threshold: input.threshold,
    action: input.action,
    request: actionToRequest(input.action),
    createdAt: Date.now(),
    createdBy: input.createdBy,
    signatures: [],
    status: "pending",
  };
  store.set(approval.id, approval);
  return approval;
}

export function listApprovals(orgEnsName: string): PendingApproval[] {
  return [...store.values()]
    .filter((a) => a.orgEnsName === orgEnsName)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getApproval(id: string): PendingApproval | undefined {
  return store.get(id);
}

/** The payload every signer signs over, and what gets submitted once threshold is met. */
function signableInput(approval: PendingApproval, appId: string): WalletApiRequestSignatureInput {
  return {
    version: 1,
    method: approval.request.method,
    url: approval.request.url,
    body: approval.request.body,
    headers: { "privy-app-id": appId },
  };
}

/**
 * Adds one signer's signature. The private key is used in-process for this single signature
 * computation and discarded — it is never written to `signatures` or anywhere else. Once
 * `threshold` signatures are collected, executes the real call immediately.
 */
export async function signApproval(
  id: string,
  authorizationPrivateKey: string,
  appId: string,
): Promise<PendingApproval> {
  const approval = store.get(id);
  if (!approval) throw new Error(`No pending approval ${id}`);
  if (approval.status !== "pending") return approval;

  const signature = generateAuthorizationSignature({
    authorizationPrivateKey,
    input: signableInput(approval, appId),
  });
  if (!approval.signatures.includes(signature)) approval.signatures.push(signature);

  if (approval.signatures.length >= approval.threshold) {
    await executeApproval(approval);
  }
  return approval;
}

async function executeApproval(approval: PendingApproval): Promise<void> {
  const client = getPrivyServerClient();
  const authorization_context = { signatures: approval.signatures };
  try {
    switch (approval.action.kind) {
      case "updateWalletPolicy":
        await client.wallets().update(approval.action.walletId, {
          policy_ids: approval.action.policyIds,
          authorization_context,
        });
        break;
      case "updateWalletDisplayName":
        await client.wallets().update(approval.action.walletId, {
          display_name: approval.action.displayName,
          authorization_context,
        });
        break;
      case "detachWalletOwner":
        await client.wallets().update(approval.action.walletId, {
          owner_id: null,
          authorization_context,
        });
        break;
    }
    approval.status = "executed";
  } catch (err) {
    approval.status = "failed";
    approval.error = err instanceof Error ? err.message : String(err);
    throw err;
  }
}
