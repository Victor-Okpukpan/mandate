import { PrivyClient } from "@privy-io/server-auth";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, type Address, type Hex } from "viem";
import { arcTestnet, sepolia } from "viem/chains";

/**
 * How an agent actually signs. Production path: a Privy server wallet with a session signer, per
 * mandate.md §12.2 — the agent's own wallet holds almost nothing, and every send routes through
 * Privy's policy engine before it ever reaches the chain. Dev path: a local viem account, the
 * agent-runtime equivalent of the Enforcer's `ENFORCER_DEV_PRIVATE_KEY_ANVIL_ONLY` — explicitly
 * marked, Anvil-only, never a real network.
 */
export interface AgentSigner {
  address: Address;
  sendTransaction(chain: "sepolia" | "arc", tx: { to: Address; data?: Hex; value?: bigint }): Promise<Hex>;
}

const CAIP2 = {
  sepolia: `eip155:${sepolia.id}` as const,
  arc: `eip155:${arcTestnet.id}` as const,
};

export function makePrivySigner(privy: PrivyClient, walletId: string, address: Address): AgentSigner {
  return {
    address,
    async sendTransaction(chain, tx) {
      const result = await privy.walletApi.ethereum.sendTransaction({
        walletId,
        caip2: CAIP2[chain],
        transaction: {
          to: tx.to,
          data: tx.data,
          value: tx.value !== undefined ? `0x${tx.value.toString(16)}` : undefined,
        },
      });
      return result.hash as Hex;
    },
  };
}

/** Anvil/local-testing only. Never point this at Sepolia or Arc testnet with a real key. */
export function makeDevSigner(privateKey: Hex, rpcUrls: { sepolia: string; arc: string }): AgentSigner {
  console.warn("⚠️  Using a local dev signer — Anvil-only, never a real network.");
  const account = privateKeyToAccount(privateKey);
  const clients = {
    sepolia: createWalletClient({ account, chain: sepolia, transport: http(rpcUrls.sepolia) }),
    arc: createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrls.arc) }),
  };
  return {
    address: account.address,
    async sendTransaction(chain, tx) {
      // Dispatched explicitly rather than indexed dynamically: `clients[chain]` unions two
      // WalletClients typed for different chains, and viem's sendTransaction overloads aren't
      // compatible across that union even though each branch alone type-checks fine.
      if (chain === "sepolia") {
        return clients.sepolia.sendTransaction({ to: tx.to, data: tx.data, value: tx.value, account });
      }
      return clients.arc.sendTransaction({ to: tx.to, data: tx.data, value: tx.value, account });
    },
  };
}
