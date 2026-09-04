import { arcTestnet } from "viem/chains";
import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { MandateAnchorAbi } from "@mandate/shared/abis";

export interface SyncPayload {
  agent: Address;
  node: Hex;
  termsHash: Hex;
  expiry: bigint;
  budgetTotal: bigint;
  budgetPeriod: number;
  perTxCap: bigint;
  allowlistRoot: Hex;
  nonce: bigint;
  revoked: boolean;
}

/** Matches `MandateAnchor.sol`'s EIP-712 domain exactly — {name, version, chainId, verifyingContract}. */
function domain(anchorAddress: Address) {
  return {
    name: "MandateAnchor",
    version: "1",
    chainId: arcTestnet.id,
    verifyingContract: anchorAddress,
  } as const;
}

const SYNC_PAYLOAD_TYPES = {
  SyncPayload: [
    { name: "agent", type: "address" },
    { name: "node", type: "bytes32" },
    { name: "termsHash", type: "bytes32" },
    { name: "expiry", type: "uint64" },
    { name: "budgetTotal", type: "uint128" },
    { name: "budgetPeriod", type: "uint32" },
    { name: "perTxCap", type: "uint128" },
    { name: "allowlistRoot", type: "bytes32" },
    { name: "nonce", type: "uint64" },
    { name: "revoked", type: "bool" },
  ],
} as const;

const HEARTBEAT_TYPES = {
  HeartbeatPayload: [
    { name: "agent", type: "address" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

export function makeArcClients(rpcUrl: string, account: PrivateKeyAccount) {
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ chain: arcTestnet, transport: http(rpcUrl), account });
  return { publicClient, walletClient };
}

/** Signs and submits `syncMandate` — used for both a genuine sync and a revocation
 *  (`payload.revoked = true`), one code path either way, per MandateAnchor.sol's own NatSpec. */
export async function submitSync(
  clients: ReturnType<typeof makeArcClients>,
  anchorAddress: Address,
  payload: SyncPayload,
) {
  const signature = await clients.walletClient.signTypedData({
    domain: domain(anchorAddress),
    types: SYNC_PAYLOAD_TYPES,
    primaryType: "SyncPayload",
    message: payload,
  });

  return clients.walletClient.writeContract({
    address: anchorAddress,
    abi: MandateAnchorAbi,
    functionName: "syncMandate",
    args: [payload, signature],
    chain: arcTestnet,
  });
}

/** Signs and submits a short-lived heartbeat — bumps `updatedAt` without touching terms or nonce.
 *  `deadlineSeconds` should stay well under `MAX_STALENESS_SECONDS` so a stale signature can't be
 *  replayed to keep an agent alive past when the Enforcer would otherwise let it freeze. */
export async function submitHeartbeat(
  clients: ReturnType<typeof makeArcClients>,
  anchorAddress: Address,
  agent: Address,
  deadlineSeconds: number,
) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

  const signature = await clients.walletClient.signTypedData({
    domain: domain(anchorAddress),
    types: HEARTBEAT_TYPES,
    primaryType: "HeartbeatPayload",
    message: { agent, deadline },
  });

  return clients.walletClient.writeContract({
    address: anchorAddress,
    abi: MandateAnchorAbi,
    functionName: "heartbeat",
    args: [agent, deadline, signature],
    chain: arcTestnet,
  });
}
