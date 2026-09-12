import { createPublicClient, http, namehash, type Address, type Hex } from "viem";
import { arcTestnet, sepolia } from "viem/chains";
import { MandateAnchorAbi, MandateRegistrarAbi } from "@mandate/shared/abis";
import { getRpcUrls, getSepoliaAddresses, getArcAddresses } from "@mandate/shared/addresses";

export function makeChainClients() {
  const rpc = getRpcUrls();
  return {
    sepolia: createPublicClient({ chain: sepolia, transport: http(rpc.sepolia) }),
    arc: createPublicClient({ chain: arcTestnet, transport: http(rpc.arc) }),
  };
}

/**
 * Resolves `ensName` to its own node and reads the mandate live from `MandateRegistrar` — this is
 * the whole point of `read_my_mandate()`: the agent discovers its own budget by resolving its own
 * name, the same way any counterparty would, rather than being told a number in its system prompt.
 * `ensName` (e.g. "research.acme.eth") is configuration — it says WHICH name is this agent's own,
 * not what that name is currently allowed to do.
 */
export async function readMandateByEnsName(
  clients: ReturnType<typeof makeChainClients>,
  ensName: string,
) {
  const addresses = getSepoliaAddresses();
  if (!addresses.mandateRegistrar) throw new Error("SEPOLIA_MANDATE_REGISTRAR not set");

  const node = namehash(ensName);
  const mandate = await clients.sepolia.readContract({
    address: addresses.mandateRegistrar,
    abi: MandateRegistrarAbi,
    functionName: "getMandate",
    args: [node],
  });

  if (!mandate.exists) {
    throw new Error(`No mandate found for ${ensName} (node ${node}) — has it been issued yet?`);
  }
  return { node, mandate };
}

export async function readArcAnchor(clients: ReturnType<typeof makeChainClients>, agent: Address) {
  const addresses = getArcAddresses();
  if (!addresses.mandateAnchor) throw new Error("ARC_MANDATE_ANCHOR not set");

  const [termsHash, allowlistRoot, budgetTotal, perTxCap, expiry, budgetPeriod, updatedAt, nonce, revoked] =
    await clients.arc.readContract({
      address: addresses.mandateAnchor,
      abi: MandateAnchorAbi,
      functionName: "anchors",
      args: [agent],
    });
  return { termsHash, allowlistRoot, budgetTotal, perTxCap, expiry, budgetPeriod, updatedAt, nonce, revoked };
}

export type Node = Hex;
