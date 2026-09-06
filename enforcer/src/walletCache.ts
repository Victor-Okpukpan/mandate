import type { PrivyClient } from "@privy-io/server-auth";
import type { Address } from "viem";

/**
 * TTL-cached `walletApi.getWallets()` lookup, shared across every org a single Enforcer process
 * watches. `watcher.ts` used to call the uncached version once per sync — fine for one org, but
 * with N orgs sharing one Enforcer process that's N times the Privy API traffic for state that
 * only changes when a new agent is provisioned, which happens far less often than mandates sync.
 * One instance is created in the supervisor and its `get` method handed to every org's
 * `startWatcher` call, so they all share one cache instead of each keeping their own.
 */
export function createWalletCache(privy: PrivyClient, ttlMs = 30_000) {
  let cache: Map<Address, string> | undefined;
  let fetchedAt = 0;
  let inFlight: Promise<Map<Address, string>> | undefined;

  async function fetchAll(): Promise<Map<Address, string>> {
    const byAddress = new Map<Address, string>();
    let cursor: string | undefined;
    do {
      const page = await privy.walletApi.getWallets({ chainType: "ethereum", cursor });
      for (const wallet of page.data) {
        byAddress.set(wallet.address.toLowerCase() as Address, wallet.id);
      }
      cursor = page.nextCursor;
    } while (cursor);
    return byAddress;
  }

  return {
    async get(): Promise<Map<Address, string>> {
      const fresh = cache && Date.now() - fetchedAt < ttlMs;
      if (fresh) return cache!;
      if (!inFlight) {
        inFlight = fetchAll().finally(() => {
          inFlight = undefined;
        });
      }
      cache = await inFlight;
      fetchedAt = Date.now();
      return cache;
    },
    /** Force a refetch on the next `get()` — call after provisioning a wallet mid-session so a
     *  sync immediately after provisioning doesn't wait out a stale cache window. */
    invalidate() {
      cache = undefined;
    },
  };
}

export type WalletCache = ReturnType<typeof createWalletCache>;
