"use client";

import { useAccount, useReadContract } from "wagmi";
import { sepolia } from "viem/chains";
import type { Address } from "viem";
import { MandateRegistrarAbi } from "@mandate/shared/abis";

/**
 * Whether the CONNECTED wallet is this org's admin — `registrar.owner()`, the account that alone
 * may `issueMandate`/`revokeMandate` at the org root. Every mandate-issuing/revoking control used
 * to render for anyone connected and let the contract's own `onlyOwner` revert do the filtering;
 * that's the right call for an agent's own tools (mandate.md's "let it revert" principle), but a
 * human clicking a button that was always going to fail is a worse experience than a button that
 * explains why it's disabled. This hook is what makes that distinction possible without weakening
 * the contract-side check it mirrors — it changes what renders, never what's authorized.
 */
export function useIsOrgAdmin(registrar: Address | undefined) {
  const { address, isConnected } = useAccount();
  const { data: owner, isLoading } = useReadContract({
    address: registrar,
    abi: MandateRegistrarAbi,
    functionName: "owner",
    chainId: sepolia.id,
    query: { enabled: Boolean(registrar) },
  });

  const isAdmin = Boolean(isConnected && address && owner && address.toLowerCase() === owner.toLowerCase());
  return { isAdmin, owner, isConnected, loading: isLoading };
}
