import { arcTestnet, sepolia } from "viem/chains";
import { http, createConfig } from "wagmi";

/**
 * RPC URLs fall back to the same public endpoints `.env.example` documents — these aren't
 * secrets, and the observatory should connect out of the box in development. Contract
 * ADDRESSES are a different matter (see `lib/addresses.ts`): there's no sensible fallback for a
 * mandate registrar that doesn't exist yet.
 */
const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const arcRpcUrl = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

// The app runs many hooks per page, each with its own event watch. At wagmi's default 4s polling
// against a shared public RPC that's already doing backfills, that's enough concurrent
// `eth_getLogs`/`eth_newFilter` traffic to get 429'd — which surfaced as pages bouncing when a
// dropped read looked like missing on-chain state. 12s is still "live enough" for this tool.
const POLLING_INTERVAL = 12_000;

export const wagmiConfig = createConfig({
  chains: [sepolia, arcTestnet],
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl),
    [arcTestnet.id]: http(arcRpcUrl),
  },
  pollingInterval: POLLING_INTERVAL,
  ssr: true,
});

export { sepolia, arcTestnet };
