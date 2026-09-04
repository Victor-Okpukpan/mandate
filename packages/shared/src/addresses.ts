/**
 * Every contract address MANDATE depends on, read from the environment and nowhere else.
 * ENS explicitly disqualifies hard-coded values — the verified addresses documented in
 * SPONSOR-NOTES live only in `.env.example`, never inlined here. Throws immediately, by name,
 * if a required var is missing, instead of silently resolving to `undefined` deep in a tx.
 */
import { type Address, isAddress } from "viem";

function requireAddress(envVar: string): Address {
  const value = process.env[envVar];
  if (!value) {
    throw new Error(`Missing required env var ${envVar} — see .env.example for the full list.`);
  }
  if (!isAddress(value)) {
    throw new Error(`Env var ${envVar} is not a valid address: "${value}"`);
  }
  return value;
}

function optionalAddress(envVar: string): Address | undefined {
  const value = process.env[envVar];
  if (!value) return undefined;
  if (!isAddress(value)) {
    throw new Error(`Env var ${envVar} is not a valid address: "${value}"`);
  }
  return value;
}

/** ENSv2 (Sepolia) — authority plane. */
export function getSepoliaAddresses() {
  return {
    rootRegistry: requireAddress("SEPOLIA_ROOT_REGISTRY"),
    ethRegistry: requireAddress("SEPOLIA_ETH_REGISTRY"),
    ethRegistrar: requireAddress("SEPOLIA_ETH_REGISTRAR"),
    userRegistryImpl: requireAddress("SEPOLIA_USER_REGISTRY_IMPL"),
    permissionedResolverImpl: requireAddress("SEPOLIA_PERMISSIONED_RESOLVER_IMPL"),
    universalResolverV2: requireAddress("SEPOLIA_UNIVERSAL_RESOLVER_V2"),
    verifiableFactory: requireAddress("SEPOLIA_VERIFIABLE_FACTORY"),
    rentPriceOracle: requireAddress("SEPOLIA_RENT_PRICE_ORACLE"),
    mockUsdc: requireAddress("SEPOLIA_MOCK_USDC"),
    mandateRegistrar: optionalAddress("SEPOLIA_MANDATE_REGISTRAR"),
  } as const;
}

/** Arc testnet 5042002 — money plane. */
export function getArcAddresses() {
  return {
    usdc: requireAddress("ARC_USDC"),
    erc8004Identity: requireAddress("ARC_ERC8004_IDENTITY"),
    erc8004Reputation: requireAddress("ARC_ERC8004_REPUTATION"),
    erc8004Validation: requireAddress("ARC_ERC8004_VALIDATION"),
    erc8183Jobs: requireAddress("ARC_ERC8183_JOBS"),
    mandateAnchor: optionalAddress("ARC_MANDATE_ANCHOR"),
    agentTreasury: optionalAddress("ARC_AGENT_TREASURY"),
  } as const;
}

export function getRpcUrls() {
  const sepolia = process.env.SEPOLIA_RPC_URL;
  const arc = process.env.ARC_RPC_URL;
  if (!sepolia) throw new Error("Missing required env var SEPOLIA_RPC_URL");
  if (!arc) throw new Error("Missing required env var ARC_RPC_URL");
  return { sepolia, arc } as const;
}

export const SEPOLIA_CHAIN_ID = 11_155_111;
export const ARC_TESTNET_CHAIN_ID = 5_042_002;
