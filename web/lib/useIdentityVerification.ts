"use client";

import { useReadContract } from "wagmi";
import { arcTestnet } from "viem/chains";
import type { Address } from "viem";
import { IdentityRegistryAbi } from "@mandate/shared/abis";
import { getPublicArcAddresses } from "./publicNetworkAddresses";

export type IdentityVerification =
  | { status: "unset" }
  | { status: "loading" }
  | { status: "verified"; agentId: bigint }
  | { status: "mismatch"; agentId: bigint; realWallet: Address }
  | { status: "not-found"; agentId: bigint };

/**
 * Cross-checks a mandate's self-reported `agent.erc8004.id` text record against the REAL Arc
 * ERC-8004 IdentityRegistry — not the ENS record alone. `MandateRegistrar.bindIdentity` accepts
 * whatever `erc8004Id` the mandate's own principal supplies with no verification (it can't verify
 * cross-chain from Sepolia at all), so before this hook existed, the "identity-bound" badge the
 * plan called for would have had to trust that unverified claim outright — worse than not showing
 * a badge. This hook makes the badge real: `getAgentWallet(agentId)` on the live Arc registry is
 * the actual source of truth, and the badge only ever shows ✓ when that matches this mandate's own
 * `agentWallet`.
 */
export function useIdentityVerification(
  erc8004IdText: string | undefined,
  agentWallet: Address | undefined,
): IdentityVerification {
  const identityRegistry = getPublicArcAddresses().erc8004Identity;
  const agentId = erc8004IdText && /^\d+$/.test(erc8004IdText) ? BigInt(erc8004IdText) : undefined;

  const { data: realWallet, isLoading, isError } = useReadContract({
    address: identityRegistry,
    abi: IdentityRegistryAbi,
    functionName: "getAgentWallet",
    args: agentId !== undefined ? [agentId] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: agentId !== undefined },
  });

  if (agentId === undefined) return { status: "unset" };
  if (isLoading) return { status: "loading" };
  // `getAgentWallet` reverts ERC721NonexistentToken for an id nobody registered, or returns the
  // zero address for one whose wallet was cleared (transferred, or never set) — both read as
  // "not-found" here since neither can back a real binding.
  if (isError || !realWallet || realWallet === "0x0000000000000000000000000000000000000000") {
    return { status: "not-found", agentId };
  }
  if (agentWallet && realWallet.toLowerCase() === agentWallet.toLowerCase()) {
    return { status: "verified", agentId };
  }
  return { status: "mismatch", agentId, realWallet };
}
