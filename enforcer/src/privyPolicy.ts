import { PrivyClient } from "@privy-io/node";
import type { Address } from "viem";

/**
 * Compiles one mandate's terms into a Privy conditional policy — the fast, stateless pre-filter.
 * Per SPONSOR-NOTES §3.1b / §4.5: Privy enforces the per-tx cap and the recipient allowlist here;
 * the CUMULATIVE rolling budget is deliberately NOT enforced by Privy — its stateful aggregations
 * cap at ~10 per app, can't partition by wallet, and update their values after a request signs,
 * not before. That ledger lives on `AgentTreasury.spentAccum` instead. Two different jobs, not a
 * belt-and-suspenders duplicate: see ARCHITECTURE.md.
 *
 * REWRITE NOTES (was a real bypass before this pass — read before touching this file again):
 *
 * 1. The two ALLOW rules used to be SEPARATE ("restrict-to-treasury" and "per-tx-cap"). Rules OR
 *    against each other; conditions WITHIN one rule AND. Two disjoint ALLOW rules meant a
 *    transaction only had to satisfy ONE of them — so any amount at all to the treasury passed on
 *    "restrict-to-treasury" alone, and the per-tx cap was never actually enforced. Fixed by
 *    collapsing to exactly one ALLOW rule with all three conditions ANDed together.
 * 2. `allowedRecipients` was accepted by this function and never referenced — the allowlist Privy
 *    was documented as enforcing did not exist as a rule. Fixed: it's now a required `in` condition
 *    on `payTo.to`, sourced by the caller from `mandate.allow.human` via `parseAllowHuman`
 *    (`@mandate/shared/allowHuman`).
 * 3. Calldata condition `field` values were bare argument names (`"amount"`, `"to"`). The live
 *    Privy API rejects that — verified against a real app, not just the SDK's `.d.ts` — and
 *    requires `"functionName.argumentName"` (`"payTo.amount"`, `"payTo.to"`). Bare names would
 *    have failed `createPolicy` outright the first time this ever ran for real.
 * 4. `ensurePolicyForAgent` created a brand-new policy on every single sync (issued AND amended),
 *    named `mandate-<node[0..10]>` — not unique per amendment — and never checked for an existing
 *    one. Every re-sync orphaned a duplicate policy that `getWallets()`'s `policyIds` no longer
 *    referenced and that `getPolicy` (there's no `listPolicies`) could never find again. Fixed:
 *    the caller resolves the wallet's current `policyIds[0]` and `updatePolicy`s it in place;
 *    `createPolicy` only runs the first time a wallet has no policy at all.
 * 5. Revocation left the previously-attached policy's ALLOW rule intact — the code comment claimed
 *    "deny-by-default rule already blocks it," but the ALLOW rule sits ABOVE that deny rule and
 *    still matches a qualifying transaction. Fixed: `revokePolicyForWallet` rewrites the policy
 *    down to a single `DENY *` rule, so revocation fails closed on the Privy layer too, not only
 *    on-chain.
 *
 * MIGRATION NOTES (`@privy-io/server-auth` → `@privy-io/node`, both verified live against the
 * project's own Privy app before and after):
 * 6. The facade's field names are snake_case (`chain_type`, `field_source`) where server-auth used
 *    camelCase (`chainType`, `fieldSource`) — a straight rename, same values, same live-verified
 *    "functionName.argumentName" calldata field format from note 3.
 * 7. `wallets().get(id)`/`.update(id, params)` take the wallet ID positionally, not as `{ id }`;
 *    the response field is `wallet.policy_ids`, not `wallet.policyIds`.
 */

export interface MandateTermsForPolicy {
  agentTreasury: Address;
  perTxCapUsdcBaseUnits: bigint;
  /** Recipient addresses from `mandate.allow.human`, via `parseAllowHuman`. Empty means the
   *  allowlist condition would match nothing — callers should treat that as "do not sync yet"
   *  rather than compiling a policy no payment could ever pass. */
  allowedRecipients: Address[];
}

/** Just enough of AgentTreasury's ABI for Privy's calldata-condition decoder to find `to` and
 *  `amount` on the `payTo` call it's guarding. */
const PAY_TO_ABI = [
  {
    type: "function",
    name: "payTo",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const DENY_ALL_RULE = {
  name: "deny-everything-else",
  method: "*" as const,
  action: "DENY" as const,
  conditions: [],
};

/** The one rule a qualifying payment must satisfy, all three conditions ANDed. Extracted so
 *  `createPolicyForAgent` (create path) and `syncPolicyForWallet` (update path) build byte-for-byte
 *  the same rule from the same terms. */
function buildMandateGateRule(terms: MandateTermsForPolicy) {
  return {
    name: "mandate-gate",
    method: "eth_sendTransaction" as const,
    action: "ALLOW" as const,
    conditions: [
      {
        field_source: "ethereum_transaction" as const,
        field: "to" as const,
        operator: "eq" as const,
        value: terms.agentTreasury,
      },
      {
        field_source: "ethereum_calldata" as const,
        field: "payTo.amount",
        operator: "lte" as const,
        value: terms.perTxCapUsdcBaseUnits.toString(),
        abi: PAY_TO_ABI,
      },
      {
        field_source: "ethereum_calldata" as const,
        field: "payTo.to",
        operator: "in" as const,
        value: terms.allowedRecipients,
        abi: PAY_TO_ABI,
      },
    ],
  };
}

/**
 * Creates a fresh policy for a wallet that doesn't have one yet. Named `mandate-<node[0..10]>` —
 * not guaranteed globally unique across every possible node prefix collision, but stable and
 * legible for a hackathon-scope single-org deployment. Callers should prefer
 * `syncPolicyForWallet`, which only falls back to this when the wallet is genuinely unpolicied.
 */
export async function createPolicyForAgent(
  privy: PrivyClient,
  mandateNode: string,
  terms: MandateTermsForPolicy,
): Promise<{ policyId: string }> {
  const policyName = `mandate-${mandateNode.slice(0, 10)}`;
  const policy = await privy.policies().create({
    name: policyName,
    version: "1.0",
    chain_type: "ethereum",
    rules: [buildMandateGateRule(terms), DENY_ALL_RULE],
  });
  return { policyId: policy.id };
}

/**
 * The routine path — call this on every sync, not just the first one. Resolves the wallet's
 * current policy (there is no `listPolicies`, so `getWallets`'s own `policy_ids` is the only way
 * to find it) and `updatePolicy`s it in place with the freshly-compiled rule; only creates a new
 * policy the first time this wallet has none. This is what stops every amendment from orphaning a
 * duplicate.
 */
export async function syncPolicyForWallet(
  privy: PrivyClient,
  walletId: string,
  mandateNode: string,
  terms: MandateTermsForPolicy,
): Promise<{ policyId: string }> {
  const wallet = await privy.wallets().get(walletId);
  const existingPolicyId = wallet.policy_ids?.[0];

  if (!existingPolicyId) {
    const { policyId } = await createPolicyForAgent(privy, mandateNode, terms);
    await privy.wallets().update(walletId, { policy_ids: [policyId] });
    return { policyId };
  }

  const updated = await privy.policies().update(existingPolicyId, {
    rules: [buildMandateGateRule(terms), DENY_ALL_RULE],
  });
  // Idempotent — the wallet already carries this policy id if it got here via the branch above,
  // but a wallet whose policy_ids were set by some other path might not, so keep it explicit.
  await privy.wallets().update(walletId, { policy_ids: [updated.id] });
  return { policyId: updated.id };
}

/**
 * The kill switch's off-chain half. Revoking a mandate must make its wallet unable to sign a
 * qualifying payment through Privy, not merely leave it to the on-chain `MandateAnchor` check —
 * fails closed on BOTH layers, independently, per the product's own thesis. Rewrites the existing
 * policy down to a bare `DENY *`; does nothing (silently) if the wallet was never given a policy,
 * since there's nothing to close off.
 */
export async function revokePolicyForWallet(privy: PrivyClient, walletId: string): Promise<void> {
  const wallet = await privy.wallets().get(walletId);
  const existingPolicyId = wallet.policy_ids?.[0];
  if (!existingPolicyId) return;
  await privy.policies().update(existingPolicyId, { rules: [DENY_ALL_RULE] });
}
