"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { sepolia } from "viem/chains";
import { WagmiProvider as PlainWagmiProvider } from "wagmi";
import { wagmiConfig } from "../lib/wagmi";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

/**
 * Wagmi + react-query always mount, so read-only chain data (the authority graph, the treasury
 * ledger) works with no login at all — this is a read-heavy observatory first. Privy wraps around
 * that only when NEXT_PUBLIC_PRIVY_APP_ID is actually set.
 *
 * `@privy-io/wagmi`'s `WagmiProvider` bridges Privy's own wallet state into wagmi's connector
 * state — it calls Privy's hooks internally and requires a `PrivyProvider` ancestor to exist, so
 * it cannot stand in for plain wagmi when Privy isn't configured. The two branches below use
 * genuinely different `WagmiProvider` implementations, not the same one conditionally wrapped.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  if (!PRIVY_APP_ID) {
    return (
      <QueryClientProvider client={queryClient}>
        <PlainWagmiProvider config={wagmiConfig}>{children}</PlainWagmiProvider>
      </QueryClientProvider>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#3d7dff",
        },
        defaultChain: sepolia,
        supportedChains: [sepolia],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={wagmiConfig}>{children}</PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
