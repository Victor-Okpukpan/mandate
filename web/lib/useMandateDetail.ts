"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { sepolia, arcTestnet } from "viem/chains";
import type { Hex } from "viem";
import {
  MandateRegistrarAbi,
  MandateAnchorAbi,
  AgentTreasuryAbi,
  PermissionedResolverAbi,
} from "@mandate/shared/abis";
import { MANDATE_KEYS, AGENT_KEYS, BINDING_KEYS } from "@mandate/shared/ensKeys";
import { parseAllowHuman } from "@mandate/shared/allowHuman";
import type { DeployedAddresses } from "./addresses";

/** Ordered so the drawer/page render principal-written records before agent-written ones —
 *  the same visual order the security model implies (who can write it, most-restricted first). */
const MANDATE_TEXT_KEYS = Object.values(MANDATE_KEYS).filter((k) => k !== MANDATE_KEYS.allowHuman);
const AGENT_TEXT_KEYS = Object.values(AGENT_KEYS);
const BINDING_TEXT_KEYS = Object.values(BINDING_KEYS);

export interface MandateRecord {
  key: string;
  value: string;
}

/**
 * The one place the ENS/Privy/Arc triptych is actually read — shared by the tree drawer and the
 * standalone `/agent/[name]` deep link so the two never drift into showing different fields for
 * the same node. Composes three chains' worth of reads behind a single `node` argument.
 */
export function useMandateDetail(node: Hex | undefined, addresses: DeployedAddresses) {
  const { data: mandate, isLoading: mandateLoading } = useReadContract({
    address: addresses.mandateRegistrar,
    abi: MandateRegistrarAbi,
    functionName: "getMandate",
    args: node ? [node] : undefined,
    chainId: sepolia.id,
    query: { enabled: Boolean(node && addresses.mandateRegistrar) },
  });

  const resolverAddress = mandate?.resolver;

  const { data: mandateTextResults } = useReadContracts({
    contracts: MANDATE_TEXT_KEYS.map((key) => ({
      address: resolverAddress,
      abi: PermissionedResolverAbi,
      functionName: "text" as const,
      args: node ? ([node, key] as const) : undefined,
      chainId: sepolia.id,
    })),
    query: { enabled: Boolean(resolverAddress && node) },
  });

  const { data: agentTextResults } = useReadContracts({
    contracts: AGENT_TEXT_KEYS.map((key) => ({
      address: resolverAddress,
      abi: PermissionedResolverAbi,
      functionName: "text" as const,
      args: node ? ([node, key] as const) : undefined,
      chainId: sepolia.id,
    })),
    query: { enabled: Boolean(resolverAddress && node) },
  });

  const { data: bindingTextResults } = useReadContracts({
    contracts: BINDING_TEXT_KEYS.map((key) => ({
      address: resolverAddress,
      abi: PermissionedResolverAbi,
      functionName: "text" as const,
      args: node ? ([node, key] as const) : undefined,
      chainId: sepolia.id,
    })),
    query: { enabled: Boolean(resolverAddress && node) },
  });

  // `mandate.allow.human` — the actual recipient list, not the merkle root the contract checks
  // against. This is the one thing an admin actually wants to see ("who can this agent pay?"); the
  // root alone is meaningless to read.
  const { data: allowHumanResult } = useReadContract({
    address: resolverAddress,
    abi: PermissionedResolverAbi,
    functionName: "text",
    args: node ? [node, MANDATE_KEYS.allowHuman] : undefined,
    chainId: sepolia.id,
    query: { enabled: Boolean(resolverAddress && node) },
  });
  const allowedRecipients = parseAllowHuman(allowHumanResult ?? "");

  const agentWallet = mandate?.agentWallet;

  const { data: anchor } = useReadContract({
    address: addresses.mandateAnchor,
    abi: MandateAnchorAbi,
    functionName: "anchors",
    args: agentWallet ? [agentWallet] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(agentWallet && addresses.mandateAnchor) },
  });

  const { data: account } = useReadContract({
    address: addresses.agentTreasury,
    abi: AgentTreasuryAbi,
    functionName: "accounts",
    args: agentWallet ? [agentWallet] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(agentWallet && addresses.agentTreasury) },
  });

  const mandateRecords: MandateRecord[] = MANDATE_TEXT_KEYS.map((key, i) => ({
    key,
    value: String(mandateTextResults?.[i]?.result ?? ""),
  }));
  const agentRecords: MandateRecord[] = AGENT_TEXT_KEYS.map((key, i) => ({
    key,
    value: String(agentTextResults?.[i]?.result ?? ""),
  }));
  const bindingRecords: MandateRecord[] = BINDING_TEXT_KEYS.map((key, i) => ({
    key,
    value: String(bindingTextResults?.[i]?.result ?? ""),
  }));

  return {
    mandate,
    mandateLoading,
    agentWallet,
    mandateRecords,
    agentRecords,
    bindingRecords,
    allowedRecipients,
    anchor,
    account,
  };
}
