"use client";

import { useEffect, useMemo, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { sepolia, arcTestnet } from "viem/chains";
import type { Address } from "viem";
import { ArcVaultFactoryAbi, MandateOrgFactoryAbi } from "@mandate/shared/abis";
import { getContractEventsChunked } from "@mandate/shared/eventLogs";
import { joinOrgVaults, type Org, type Vault } from "@mandate/shared/orgs";
import { getDeployedAddresses } from "./addresses";

const ORG_FACTORY_DEPLOY_BLOCK = process.env.NEXT_PUBLIC_MANDATE_ORG_FACTORY_DEPLOY_BLOCK
  ? BigInt(process.env.NEXT_PUBLIC_MANDATE_ORG_FACTORY_DEPLOY_BLOCK)
  : "earliest";
const VAULT_FACTORY_DEPLOY_BLOCK = process.env.NEXT_PUBLIC_ARC_VAULT_FACTORY_DEPLOY_BLOCK
  ? BigInt(process.env.NEXT_PUBLIC_ARC_VAULT_FACTORY_DEPLOY_BLOCK)
  : "earliest";

/**
 * The org directory — event-sourced from `MandateOrgFactory.OrgCreated` (Sepolia) and
 * `ArcVaultFactory.VaultCreated` (Arc), joined by `orgRootNode`, exactly like `useMandateGraph`
 * reads a mandate tree from nothing but the registrar's own logs. Backfills once (chunked — see
 * `@mandate/shared/eventLogs`'s own NatSpec on why a single unchunked call eventually fails
 * against a real RPC's `eth_getLogs` range cap), then `useWatchContractEvent`s both factories live
 * — an org onboarded through the wizard a moment ago appears here without a page reload, which is
 * the entire point of self-serve onboarding (see HOW-IT-WORKS.md §4's "OrgCreated makes the
 * Enforcer self-serve" — the same log this hook reads).
 *
 * No single-org fallback, deliberately — an org exists to this hook only if the factory logs say
 * it does, the same rule `enforcer/src/orgSupervisor.ts` enforces server-side. An org that predates
 * the factory (or was seeded directly) is real on-chain but invisible here; that's the honest
 * outcome, not a bug to paper over with a synthesized entry.
 */
export function useOrgs() {
  const addresses = getDeployedAddresses();
  const factoryConfigured = Boolean(addresses.mandateOrgFactory && addresses.arcVaultFactory);

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(factoryConfigured);
  // Whether the vault read has completed at least once. `loading` must not go false until it has,
  // or a consumer (OrgGuard) sees an org with no vault for a frame and wrongly bounces it as
  // "half-built" — that was a redirect loop between the dashboard and the wizard.
  const [vaultsChecked, setVaultsChecked] = useState(false);
  // A clean vault read actually landed (not just "we tried"). OrgGuard only bounces a vault-less
  // org when this is true — a dropped RPC call must never look like "org isn't set up".
  const [vaultsConfirmed, setVaultsConfirmed] = useState(false);
  const sepoliaClient = usePublicClient({ chainId: sepolia.id });
  const arcClient = usePublicClient({ chainId: arcTestnet.id });

  useEffect(() => {
    if (!addresses.mandateOrgFactory || !sepoliaClient) {
      setOrgsLoading(false);
      return;
    }
    let cancelled = false;

    async function backfill() {
      setOrgsLoading(true);
      const logs = await getContractEventsChunked(sepoliaClient!, {
        address: addresses.mandateOrgFactory!,
        abi: MandateOrgFactoryAbi,
        eventName: "OrgCreated",
        fromBlock: ORG_FACTORY_DEPLOY_BLOCK,
      });
      if (cancelled) return;
      setOrgs(
        logs.map((log) => ({
          registrar: log.args.registrar!,
          orgRootRegistry: log.args.orgRootRegistry!,
          admin: log.args.admin!,
          orgRootNode: log.args.orgRootNode!,
          orgEnsName: log.args.orgEnsName!,
          createdAtBlock: log.blockNumber,
        })),
      );
      setOrgsLoading(false);
    }
    backfill().catch((e) => console.warn("[useOrgs] backfill failed", e));
    return () => {
      cancelled = true;
    };
  }, [addresses.mandateOrgFactory, sepoliaClient]);

  useWatchContractEvent({
    address: addresses.mandateOrgFactory,
    abi: MandateOrgFactoryAbi,
    eventName: "OrgCreated",
    chainId: sepolia.id,
    enabled: factoryConfigured,
    onLogs(logs) {
      setOrgs((prev) => [
        ...prev,
        ...logs.map((log) => ({
          registrar: log.args.registrar!,
          orgRootRegistry: log.args.orgRootRegistry!,
          admin: log.args.admin!,
          orgRootNode: log.args.orgRootNode!,
          orgEnsName: log.args.orgEnsName!,
          createdAtBlock: log.blockNumber!,
        })),
      ]);
    },
  });

  // Vaults are read by direct contract call (`vaultsOfAdmin` → `vaults`), not from `VaultCreated`
  // logs: Arc's public RPC rejects `eth_getLogs` over any range wide enough to matter
  // ("Request exceeds defined limit"), and unlike Sepolia there's no chunk size small enough to
  // get under it reliably. The factory's own view functions have no such cap. Admins come from
  // the org list (already read from Sepolia, which works fine).
  const admins = useMemo(
    () => Array.from(new Set(orgs.map((o) => o.admin.toLowerCase()))) as Address[],
    [orgs],
  );
  const adminsKey = admins.join(",");

  useEffect(() => {
    if (!addresses.arcVaultFactory) {
      setVaultsChecked(true); // no vault factory → no vaults to wait for
      return;
    }
    if (!arcClient || admins.length === 0) return;
    let cancelled = false;

    // Public RPCs 429 under the app's watch/backfill load; a dropped vault read would otherwise
    // read as "org has no vault" and bounce the user out. Retry with backoff, and only mark the
    // check *confirmed* on a fully clean pass — OrgGuard trusts `vaultsConfirmed`, not a guess.
    async function readWithRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
      let lastErr: unknown;
      for (let i = 0; i < tries; i++) {
        try {
          return await fn();
        } catch (e) {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 400 * 2 ** i));
        }
      }
      throw lastErr;
    }

    async function load() {
      const anchorLists = await Promise.all(
        admins.map((admin) =>
          readWithRetry(() =>
            arcClient!.readContract({
              address: addresses.arcVaultFactory!,
              abi: ArcVaultFactoryAbi,
              functionName: "vaultsOfAdmin",
              args: [admin],
            }),
          ),
        ),
      );
      const anchors = Array.from(new Set(anchorLists.flat()));
      const details = await Promise.all(
        anchors.map((anchor) =>
          readWithRetry(() =>
            arcClient!.readContract({
              address: addresses.arcVaultFactory!,
              abi: ArcVaultFactoryAbi,
              functionName: "vaults",
              args: [anchor],
            }),
          ),
        ),
      );
      if (cancelled) return;
      setVaults(
        details.map((d) => ({
          anchor: d[0],
          treasury: d[1],
          admin: d[2],
          enforcer: "0x0000000000000000000000000000000000000000" as Address,
          orgRootNode: d[3],
          // `vaults().createdAt` is a block.timestamp, not a block number — the factory deploy
          // block is the only safe lower bound available without an Arc log query.
          createdAtBlock: VAULT_FACTORY_DEPLOY_BLOCK === "earliest" ? 0n : VAULT_FACTORY_DEPLOY_BLOCK,
        })),
      );
      setVaultsChecked(true);
      setVaultsConfirmed(true);
    }
    load().catch((e) => {
      console.warn("[useOrgs] vault load failed after retries", e);
      if (!cancelled) setVaultsChecked(true); // let `loading` resolve; `vaultsConfirmed` stays false
    });
    const id = setInterval(() => load().catch(() => {}), 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.arcVaultFactory, arcClient, adminsKey]);

  // (No `VaultCreated` watch — the 15s `load()` poll above already picks up a new vault, and Arc's
  // public RPC can't take another filter subscription on top of everything else.)

  // Not "done" until vaults have been read at least once (when there's an org whose vault we'd
  // need to know about) — see the `vaultsChecked` comment above.
  const loading = factoryConfigured && (orgsLoading || (orgs.length > 0 && !vaultsChecked));

  return {
    orgs: factoryConfigured ? joinOrgVaults(orgs, vaults) : [],
    loading,
    factoryConfigured,
    vaultsConfirmed: !factoryConfigured || !addresses.arcVaultFactory || vaultsConfirmed,
  };
}
