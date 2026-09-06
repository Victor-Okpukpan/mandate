import type { Address } from "viem";

/**
 * Client-safe network addresses — the public, verified ENSv2/Arc sponsor addresses, not org
 * deployments. `packages/shared/src/addresses.ts`'s `getSepoliaAddresses`/`getArcAddresses` are
 * server-only loaders (they throw on a missing bare env var and were never meant to reach a
 * browser bundle — Next only inlines `NEXT_PUBLIC_*` names into the client anyway). This is the
 * client-side equivalent for the handful of addresses a page actually needs to call directly,
 * same fallback-with-override pattern `/jobs`'s `JOBS_ADDRESS` already uses.
 */
export function getPublicSepoliaAddresses() {
  return {
    ethRegistrar: (process.env.NEXT_PUBLIC_SEPOLIA_ETH_REGISTRAR ??
      "0xa88553F454b77203B0D036A05c894d555EAAa2Cc") as Address,
    mockUsdc: (process.env.NEXT_PUBLIC_SEPOLIA_MOCK_USDC ??
      "0x768F42455A2D082E23ceeF7d51e5787C82d67a39") as Address,
  };
}

export function getPublicArcAddresses() {
  return {
    usdc: (process.env.NEXT_PUBLIC_ARC_USDC ??
      "0x3600000000000000000000000000000000000000") as Address,
    erc8004Identity: (process.env.NEXT_PUBLIC_ARC_ERC8004_IDENTITY ??
      "0x8004A818BFB912233c491871b3d84c89A494BD9e") as Address,
    erc8004Reputation: (process.env.NEXT_PUBLIC_ARC_ERC8004_REPUTATION ??
      "0x8004B663056A597Dffe9eCcC1965A193B7388713") as Address,
  };
}
