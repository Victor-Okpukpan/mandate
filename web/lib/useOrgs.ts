"use client";

import { useEffect, useMemo, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { sepolia, arcTestnet } from "viem/chains";
import type { Address } from "viem";
import { MandateOrgFactoryAbi } from "@mandate/shared/abis";
import { joinOrgVaults, listOrgsDirect, listVaultsForAdmins, type Org, type Vault } from "@mandate/shared/orgs";
import { getDeployedAddresses } from "./addresses";

const ORG_FACTORY_DEPLOY_BLOCK = process.env.NEXT_PUBLIC_MANDATE_ORG_FACTORY_DEPLOY_BLOCK
  ? BigInt(process.env.NEXT_PUBLIC_MANDATE_ORG_FACTORY_DEPLOY_BLOCK)
  : "earliest";
const VAULT_FACTORY_DEPLOY_BLOCK = process.env.NEXT_PUBLIC_ARC_VAULT_FACTORY_DEPLOY_BLOCK
  ? BigInt(process.env.NEXT_PUBLIC_ARC_VAULT_FACTORY_DEPLOY_BLOCK)
  : "earliest";

/**
 * The org directory — read live from `MandateOrgFactory` (Sepolia) and `ArcVaultFactory` (Arc),
 * joined by `orgRootNode`. Orgs are discovered by direct contract-state read (`orgCount` +
 * `registrarsPaginated` + `orgs(registrar)`, see `listOrgsDirect`), not `eth_getLogs` — a public,
 * multi-tenant Sepolia RPC has been observed to silently return an empty log result for a real,
 * existing range (no error, just `[]`), which made the entire directory look empty even though
 * nothing on-chain had changed. `useWatchContractEvent` still watches both factories live for a
 * same-session "org appears without a reload" feel, but the 15s re-poll below (matching the vault
 * read's own polling) is what actually guarantees correctness if that watcher's log subscription
 * hits the same flaky-RPC failure mode.
 *
 * No single-org fallback, deliberately — an org exists to this hook only if the factory says it
 * does, the same rule `enforcer/src/orgSupervisor.ts` enforces server-side. An org that predates
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
    const fallbackBlock = ORG_FACTORY_DEPLOY_BLOCK === "earliest" ? 0n : ORG_FACTORY_DEPLOY_BLOCK;

    async function load() {
      const result = await listOrgsDirect(sepoliaClient!, addresses.mandateOrgFactory!, fallbackBlock);
      if (cancelled) return;
      // Every poll tick builds a fresh array even when nothing changed — setting it unconditionally
      // would re-render every consumer (and everything downstream of it) on a 15s cadence forever,
      // which is exactly what caused a `/org/[name]` prefetch storm on the onboarding wizard: a
      // failed Next.js prefetch isn't cached, so a re-render-every-15s loop kept re-attempting it
      // until the tab ran out of connections (`ERR_INSUFFICIENT_RESOURCES`). Only commit a new
      // array when the actual registrar set changed.
      setOrgs((prev) => {
        const prevKey = prev.map((o) => o.registrar).sort().join(",");
        const nextKey = result.map((o) => o.registrar).sort().join(",");
        return prevKey === nextKey ? prev : result;
      });
      setOrgsLoading(false);
    }
    load().catch((e) => {
      console.warn("[useOrgs] org read failed", e);
      if (!cancelled) setOrgsLoading(false);
    });
    // Same reasoning as the vault poll below: a dropped or flaky RPC read must resolve on its own
    // shortly after, not require a manual page reload.
    const id = setInterval(() => load().catch(() => {}), 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
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

    // `listVaultsForAdmins` already retries each call — a dropped read here would otherwise read
    // as "org has no vault" and bounce the user out. Only mark the check *confirmed* on a fully
    // clean pass — OrgGuard trusts `vaultsConfirmed`, not a guess.
    async function load() {
      // `vaults().createdAt` is a block.timestamp, not a block number — the factory deploy block
      // is the only safe `fromBlock` floor available without an Arc log query.
      const fallbackBlock = VAULT_FACTORY_DEPLOY_BLOCK === "earliest" ? 0n : VAULT_FACTORY_DEPLOY_BLOCK;
      const result = await listVaultsForAdmins(arcClient!, addresses.arcVaultFactory!, admins, fallbackBlock);
      if (cancelled) return;
      // Same reasoning as the org poll above — don't commit a fresh array (and cascade a re-render)
      // when the actual vault set hasn't changed.
      setVaults((prev) => {
        const prevKey = prev.map((v) => v.anchor).sort().join(",");
        const nextKey = result.map((v) => v.anchor).sort().join(",");
        return prevKey === nextKey ? prev : result;
      });
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
