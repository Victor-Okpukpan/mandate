"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useReadContracts, useWatchContractEvent } from "wagmi";
import { sepolia, arcTestnet } from "viem/chains";
import {
  ArcVaultFactoryAbi,
  MandateAnchorAbi,
  MandateOrgFactoryAbi,
  MandateRegistrarAbi,
} from "@mandate/shared/abis";
import { joinOrgVaults, type Org, type Vault, type OrgWithVault } from "@mandate/shared/orgs";
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
 * reads a mandate tree from nothing but the registrar's own logs. Backfills once, then
 * `useWatchContractEvent`s both factories live — an org onboarded through the wizard a moment ago
 * appears here without a page reload, which is the entire point of self-serve onboarding (see
 * HOW-IT-WORKS.md §4's "OrgCreated makes the Enforcer self-serve" — the same log this hook reads).
 *
 * Falls back to a single synthesized org from the single-org env vars when no factory is
 * configured, reading its real `owner`/`orgEnsName`/`ORG_ROOT_NODE`/`enforcer` on-chain rather
 * than inventing placeholder values — a page built against this hook should never be able to tell
 * whether it's looking at a factory-created org or the pre-factory fallback.
 */
export function useOrgs() {
  const addresses = getDeployedAddresses();
  const factoryConfigured = Boolean(addresses.mandateOrgFactory);

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
      const logs = await sepoliaClient!.getContractEvents({
        address: addresses.mandateOrgFactory!,
        abi: MandateOrgFactoryAbi,
        eventName: "OrgCreated",
        fromBlock: ORG_FACTORY_DEPLOY_BLOCK,
        toBlock: "latest",
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
      const logs = await arcClient!.getContractEvents({
        address: addresses.arcVaultFactory!,
        abi: ArcVaultFactoryAbi,
        eventName: "VaultCreated",
        fromBlock: VAULT_FACTORY_DEPLOY_BLOCK,
        toBlock: "latest",
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

  // Fallback path: no factory configured, but a single-org registrar/vault exists. Read its real
  // identity on-chain — called unconditionally (gated by `enabled`) so this hook never has a
  // Rules-of-Hooks branch of its own.
  const needsFallback = !factoryConfigured && Boolean(addresses.mandateRegistrar);
  const { data: registrarReads } = useReadContracts({
    contracts: [
      {
        address: addresses.mandateRegistrar,
        abi: MandateRegistrarAbi,
        functionName: "owner",
        chainId: sepolia.id,
      },
      {
        address: addresses.mandateRegistrar,
        abi: MandateRegistrarAbi,
        functionName: "orgEnsName",
        chainId: sepolia.id,
      },
      {
        address: addresses.mandateRegistrar,
        abi: MandateRegistrarAbi,
        functionName: "ORG_ROOT_NODE",
        chainId: sepolia.id,
      },
      {
        address: addresses.mandateRegistrar,
        abi: MandateRegistrarAbi,
        functionName: "ORG_ROOT_REGISTRY",
        chainId: sepolia.id,
      },
    ],
    query: { enabled: needsFallback },
  });
  const { data: anchorReads } = useReadContracts({
    contracts: [
      {
        address: addresses.mandateAnchor,
        abi: MandateAnchorAbi,
        functionName: "enforcer",
        chainId: arcTestnet.id,
      },
    ],
    query: { enabled: needsFallback && Boolean(addresses.mandateAnchor) },
  });

  const fallbackOrg: OrgWithVault | undefined =
    needsFallback && registrarReads?.[0]?.result
      ? {
          registrar: addresses.mandateRegistrar!,
          orgRootRegistry: (registrarReads[3]?.result as `0x${string}` | undefined) ?? addresses.mandateRegistrar!,
          admin: registrarReads[0].result as `0x${string}`,
          orgRootNode: (registrarReads[2]?.result as `0x${string}` | undefined) ?? ZERO_NODE,
          orgEnsName: (registrarReads[1]?.result as string | undefined) ?? "unknown.eth",
          createdAtBlock: 0n,
          vault:
            addresses.mandateAnchor && addresses.agentTreasury
              ? {
                  anchor: addresses.mandateAnchor,
                  treasury: addresses.agentTreasury,
                  admin: registrarReads[0].result as `0x${string}`,
                  enforcer: (anchorReads?.[0]?.result as `0x${string}` | undefined) ?? ZERO_ADDRESS,
                  orgRootNode: (registrarReads[2]?.result as `0x${string}` | undefined) ?? ZERO_NODE,
                  createdAtBlock: 0n,
                }
              : undefined,
        }
      : undefined;

  return {
    orgs: factoryConfigured ? joinOrgVaults(orgs, vaults) : fallbackOrg ? [fallbackOrg] : [],
    loading: factoryConfigured ? loading : needsFallback && !registrarReads,
    factoryConfigured,
  };
}

const ZERO_NODE = `0x${"0".repeat(64)}` as const;
const ZERO_ADDRESS = `0x${"0".repeat(40)}` as const;
