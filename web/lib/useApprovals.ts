"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptionalPrivy } from "./usePrivyMandateStatus";

export type ApprovalAction =
  | { kind: "updateWalletPolicy"; walletId: string; policyIds: string[] }
  | { kind: "updateWalletDisplayName"; walletId: string; displayName: string }
  | { kind: "detachWalletOwner"; walletId: string };

export interface Approval {
  id: string;
  action: ApprovalAction;
  threshold: number;
  signatureCount: number;
  status: "pending" | "executed" | "failed";
  error?: string;
  createdAt: number;
  createdBy: string;
}

async function authedJSON(
  path: string,
  getAccessToken: () => Promise<string | null>,
  init?: RequestInit,
) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in to Privy.");
  const res = await fetch(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${path} returned ${res.status}`);
  return data;
}

/**
 * The org's pending tier-gated actions — see `web/lib/approvals.ts` for the mechanism. Exposes
 * `propose` (create a new one) and `sign` (add this signer's signature; executes automatically
 * once threshold is met) alongside the live list.
 */
export function useApprovals(orgEnsName: string | undefined) {
  const privy = useOptionalPrivy();
  const authenticated = privy?.authenticated ?? false;
  const getAccessToken = privy?.getAccessToken;
  const queryClient = useQueryClient();
  const queryKey = ["approvals", orgEnsName];

  const query = useQuery({
    queryKey,
    enabled: Boolean(orgEnsName && authenticated && getAccessToken),
    refetchInterval: 5000,
    queryFn: async (): Promise<Approval[]> => {
      if (!orgEnsName || !getAccessToken) return [];
      const data = await authedJSON(`/api/approvals?org=${encodeURIComponent(orgEnsName)}`, getAccessToken);
      return data.approvals as Approval[];
    },
  });

  async function propose(quorumId: string, action: ApprovalAction) {
    if (!orgEnsName || !getAccessToken) throw new Error("Not signed in.");
    await authedJSON("/api/approvals", getAccessToken, {
      method: "POST",
      body: JSON.stringify({ orgEnsName, quorumId, action }),
    });
    await queryClient.invalidateQueries({ queryKey });
  }

  async function sign(approvalId: string, authorizationPrivateKey: string) {
    if (!getAccessToken) throw new Error("Not signed in.");
    const result = await authedJSON(`/api/approvals/${approvalId}/sign`, getAccessToken, {
      method: "POST",
      body: JSON.stringify({ authorizationPrivateKey }),
    });
    await queryClient.invalidateQueries({ queryKey });
    return result as Approval;
  }

  return {
    approvals: query.data ?? [],
    loading: query.isLoading,
    propose,
    sign,
  };
}
