"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { sepolia, arcTestnet } from "viem/chains";
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
  const [loading, setLoading] = useState(factoryConfigured);
  const sepoliaClient = usePublicClient({ chainId: sepolia.id });
  const arcClient = usePublicClient({ chainId: arcTestnet.id });

  useEffect(() => {
    if (!addresses.mandateOrgFactory || !sepoliaClient) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function backfill() {
      setLoading(true);
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
      setLoading(false);
    }
    backfill();
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

  useEffect(() => {
    if (!addresses.arcVaultFactory || !arcClient) return;
    let cancelled = false;

    async function backfill() {
      const logs = await getContractEventsChunked(arcClient!, {
        address: addresses.arcVaultFactory!,
        abi: ArcVaultFactoryAbi,
        eventName: "VaultCreated",
        fromBlock: VAULT_FACTORY_DEPLOY_BLOCK,
      });
      if (cancelled) return;
      setVaults(
        logs.map((log) => ({
          anchor: log.args.anchor!,
          treasury: log.args.treasury!,
          admin: log.args.admin!,
          enforcer: log.args.enforcer!,
          orgRootNode: log.args.orgRootNode!,
          createdAtBlock: log.blockNumber,
        })),
      );
    }
    backfill();
    return () => {
      cancelled = true;
    };
  }, [addresses.arcVaultFactory, arcClient]);

  useWatchContractEvent({
    address: addresses.arcVaultFactory,
    abi: ArcVaultFactoryAbi,
    eventName: "VaultCreated",
    chainId: arcTestnet.id,
    enabled: Boolean(addresses.arcVaultFactory),
    onLogs(logs) {
      setVaults((prev) => [
        ...prev,
        ...logs.map((log) => ({
          anchor: log.args.anchor!,
          treasury: log.args.treasury!,
          admin: log.args.admin!,
          enforcer: log.args.enforcer!,
          orgRootNode: log.args.orgRootNode!,
          createdAtBlock: log.blockNumber!,
        })),
      ]);
    },
  });

  return {
    orgs: factoryConfigured ? joinOrgVaults(orgs, vaults) : [],
    loading: factoryConfigured ? loading : false,
    factoryConfigured,
  };
}
