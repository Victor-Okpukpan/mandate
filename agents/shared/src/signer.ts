import { PrivyClient } from "@privy-io/node";
import { privateKeyToAccount } from "viem/accounts";
import { createWalletClient, http, type Address, type Hex, type PublicClient } from "viem";
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

/**
 * `arcClient` is optional only so a Sepolia-only caller doesn't need to supply one; pass it
 * whenever the signer might be asked to send on Arc.
 *
 * Arc testnet isn't yet on Privy's list of chains its Wallet API is authorized to relay-broadcast
 * for this app (`sendTransaction` 401s: "App is not authorized to transact on chain
 * eip155:5042002") — a per-app allowlist Privy support has to flip, not something this app
 * controls. `eth_signTransaction` sits on the other side of that gate: it never touches the
 * network, it just returns an RLP-signed transaction, so there's nothing for Privy to authorize.
 * We fill in every field ourselves (nonce, gas, fees) from Arc's own RPC, get it signed, and
 * broadcast the raw bytes ourselves via `sendRawTransaction` — the private key never leaves
 * Privy's custody, only the broadcast step moves. Drop this branch once Arc is enabled and go
 * back to the one-call `sendTransaction` path Sepolia already uses.
 */
export function makePrivySigner(
  privy: PrivyClient,
  walletId: string,
  address: Address,
  arcClient?: PublicClient,
): AgentSigner {
  return {
    address,
    async sendTransaction(chain, tx) {
      if (chain === "arc") {
        if (!arcClient) throw new Error("makePrivySigner: arcClient is required to send on Arc.");
        const [nonce, fees, gasLimit] = await Promise.all([
          arcClient.getTransactionCount({ address, blockTag: "pending" }),
          arcClient.estimateFeesPerGas(),
          arcClient.estimateGas({ account: address, to: tx.to, data: tx.data, value: tx.value }),
        ]);
        const signed = await privy.wallets().ethereum().signTransaction(walletId, {
          address,
          params: {
            transaction: {
              type: 2,
              chain_id: arcTestnet.id,
              nonce,
              to: tx.to,
              data: tx.data,
              value: tx.value !== undefined ? `0x${tx.value.toString(16)}` : "0x0",
              gas_limit: `0x${gasLimit.toString(16)}`,
              max_fee_per_gas: `0x${(fees.maxFeePerGas ?? 0n).toString(16)}`,
              max_priority_fee_per_gas: `0x${(fees.maxPriorityFeePerGas ?? 0n).toString(16)}`,
            },
          },
        });
        return arcClient.sendRawTransaction({ serializedTransaction: signed.signed_transaction as Hex });
      }

      // @privy-io/node: the friendly `wallets().ethereum().sendTransaction` wraps the raw RPC
      // passthrough and nests the transaction one level deeper (`params.transaction`, not a bare
      // `transaction` field) — verified against the installed .d.ts, and the response's `.hash`
      // is flat on the result, not nested under `.data` the way the raw resource method returns it.
      const result = await privy.wallets().ethereum().sendTransaction(walletId, {
        caip2: CAIP2[chain],
        params: {
          transaction: {
            to: tx.to,
            data: tx.data,
            value: tx.value !== undefined ? `0x${tx.value.toString(16)}` : undefined,
          },
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
