"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

export interface PrivyPolicyRule {
  id: string;
  name: string;
  action: "ALLOW" | "DENY";
  method: string;
  conditions: Array<{
    fieldSource: string;
    field: string;
    operator: string;
    value: string | string[];
  }>;
}

export interface PrivyWalletSummary {
  id: string;
  address: Address;
  policyIds: string[];
}

const PRIVY_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

/** Small wrapper so a caller in a tree with no `PrivyProvider` mounted (Privy not configured at
 *  all) doesn't crash calling `usePrivy()` directly — mirrors the same guard `ConnectButton`
 *  already uses for the same reason. */
function useOptionalPrivy() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- PRIVY_CONFIGURED is a build-time
  // constant (NEXT_PUBLIC_*), so this condition never changes between renders.
  return PRIVY_CONFIGURED ? usePrivy() : null;
}

async function authedFetch(path: string, getAccessToken: () => Promise<string | null>) {
  const token = await getAccessToken();
  if (!token) throw new Error("Not signed in to Privy.");
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `${path} returned ${res.status}`);
  }
  return res.json();
}

/**
 * Finds the Privy server wallet backing a mandate's `agentWallet` address, and its currently
 * attached policy's real compiled rules — the data the drawer's Privy plane renders instead of
 * the placeholder it used to be. `getWallets()` has no address filter (confirmed against the
 * installed `.d.ts`), so this pages through wallets client-side looking for a match; capped at 10
 * pages so an unprovisioned address fails fast rather than exhausting every wallet in the app.
 */
export function usePrivyMandateStatus(agentWallet: Address | undefined) {
  const privy = useOptionalPrivy();
  const authenticated = privy?.authenticated ?? false;
  const getAccessToken = privy?.getAccessToken;

  const walletQuery = useQuery({
    queryKey: ["privy-wallet-for-agent", agentWallet],
    enabled: Boolean(agentWallet && authenticated && getAccessToken),
    queryFn: async (): Promise<PrivyWalletSummary | null> => {
      if (!agentWallet || !getAccessToken) return null;
      let cursor: string | undefined;
      for (let page = 0; page < 10; page++) {
        const url = cursor
          ? `/api/privy/wallets?cursor=${encodeURIComponent(cursor)}`
          : "/api/privy/wallets";
        const data = await authedFetch(url, getAccessToken);
        const match = (data.wallets as PrivyWalletSummary[]).find(
          (w) => w.address.toLowerCase() === agentWallet.toLowerCase(),
        );
        if (match) return match;
        if (!data.nextCursor) return null;
        cursor = data.nextCursor;
      }
      return null;
    },
  });

  const policyId = walletQuery.data?.policyIds?.[0];

  const policyQuery = useQuery({
    queryKey: ["privy-policy", policyId],
    enabled: Boolean(policyId && authenticated && getAccessToken),
    queryFn: async () => {
      if (!policyId || !getAccessToken) return null;
      return authedFetch(`/api/privy/policies/${policyId}`, getAccessToken) as Promise<{
        id: string;
        name: string;
        rules: PrivyPolicyRule[];
      }>;
    },
  });

  return {
    privyConfigured: PRIVY_CONFIGURED,
    signedIn: authenticated,
    wallet: walletQuery.data,
    walletLoading: walletQuery.isLoading,
    policy: policyQuery.data,
    policyLoading: policyQuery.isLoading,
  };
}
