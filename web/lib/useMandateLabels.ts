"use client";

import { useReadContracts } from "wagmi";
import { sepolia } from "viem/chains";
import type { Address, Hex } from "viem";
import { MandateRegistrarAbi } from "@mandate/shared/abis";

/**
 * No registrar event carries a mandate's human label — `MandateIssued` only has `node`,
 * `parentNode`, `agentWallet`, `resolver`, `termsHash`, `expiry` (confirmed against the ABI). The
 * label only exists in `getMandate(node).label` (struct index 7). Without this, the tree has
 * nothing to render but the raw node hash — which is exactly what it did before this hook existed:
 * `0x0c70…a6aee3` instead of `research.mandate.eth`. Batches one multicall for every node in the
 * tree rather than one read per row.
 */
export function useMandateLabels(nodes: readonly Hex[], registrarAddress: Address | undefined) {
  const { data } = useReadContracts({
    contracts: nodes.map((node) => ({
      address: registrarAddress,
      abi: MandateRegistrarAbi,
      functionName: "getMandate" as const,
      args: [node] as const,
      chainId: sepolia.id,
    })),
    query: { enabled: Boolean(registrarAddress && nodes.length > 0) },
  });

  const labels = new Map<Hex, string>();
  nodes.forEach((node, i) => {
    // wagmi widens `result` to an unhelpful shape when `address` in the request can be
    // `undefined` (it's gated by `enabled` above, so this is always the real struct at runtime).
    const result = data?.[i]?.result as { label?: string } | undefined;
    if (result?.label) labels.set(node, result.label);
  });
  return labels;
}
