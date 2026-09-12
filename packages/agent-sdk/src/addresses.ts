// Vendored from packages/shared/src/addresses.ts — duplicated, not imported, so this published
// package needs nothing from this monorepo. Keep in sync by hand if the source changes.
/**
 * Every contract address MANDATE depends on, read from the environment and nowhere else.
 * ENS explicitly disqualifies hard-coded values — the verified addresses documented in
 * SPONSOR-NOTES live only in `.env.example`, never inlined here. Throws immediately, by name,
 * if a required var is missing, instead of silently resolving to `undefined` deep in a tx.
 *
 * Every field below is a `get` accessor, not a plain value: validating (and potentially throwing
 * on) a field only when a caller actually reads it, rather than the whole struct up front. This
 * package's own tools only ever read `mandateRegistrar` / `mandateAnchor` / `agentTreasury` /
 * `erc8183Jobs` — a caller building an app on just `connectMandate`/`pay` shouldn't need to set
 * nine ENS-registration-only env vars it will never touch just because `getSepoliaAddresses()`
 * used to validate the entire struct eagerly. This was a real integration papercut, not a
 * hypothetical one — found live, building this package's own example app.
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
    get rootRegistry(): Address {
      return requireAddress("SEPOLIA_ROOT_REGISTRY");
    },
    get ethRegistry(): Address {
      return requireAddress("SEPOLIA_ETH_REGISTRY");
    },
    get ethRegistrar(): Address {
      return requireAddress("SEPOLIA_ETH_REGISTRAR");
    },
    get userRegistryImpl(): Address {
      return requireAddress("SEPOLIA_USER_REGISTRY_IMPL");
    },
    get permissionedResolverImpl(): Address {
      return requireAddress("SEPOLIA_PERMISSIONED_RESOLVER_IMPL");
    },
    get universalResolverV2(): Address {
      return requireAddress("SEPOLIA_UNIVERSAL_RESOLVER_V2");
    },
    get verifiableFactory(): Address {
      return requireAddress("SEPOLIA_VERIFIABLE_FACTORY");
    },
    get rentPriceOracle(): Address {
      return requireAddress("SEPOLIA_RENT_PRICE_ORACLE");
    },
    /** Circle's real Sepolia USDC — confirmed live to be one of the tokens ENSv2's
     *  ETHRegistrar accepts as `paymentToken` for `getRegisterPrice`/`register`, alongside its
     *  own now-retired project-specific `MockUSDC`. Not a mock: real, permissioned only by
     *  Circle's actual faucet, the same token every other Sepolia project already uses. */
    get usdc(): Address {
      return requireAddress("SEPOLIA_USDC");
    },
    get mandateOrgFactory(): Address | undefined {
      return optionalAddress("SEPOLIA_MANDATE_ORG_FACTORY");
    },
    /** Single-org fallback — the registrar one run of the factory flow (or the old
     *  now-deleted DeploySepolia.s.sol) produced. Multi-org callers should read
     *  `mandateOrgFactory`'s own `OrgCreated` events via `listOrgs` instead; this stays for
     *  local dev and `SeedDemo.s.sol` so nothing breaks before that plumbing lands everywhere. */
    get mandateRegistrar(): Address | undefined {
      return optionalAddress("SEPOLIA_MANDATE_REGISTRAR");
    },
  };
}

/** Arc testnet 5042002 — money plane. */
export function getArcAddresses() {
  return {
    get usdc(): Address {
      return requireAddress("ARC_USDC");
    },
    get erc8004Identity(): Address {
      return requireAddress("ARC_ERC8004_IDENTITY");
    },
    get erc8004Reputation(): Address {
      return requireAddress("ARC_ERC8004_REPUTATION");
    },
    get erc8004Validation(): Address {
      return requireAddress("ARC_ERC8004_VALIDATION");
    },
    get erc8183Jobs(): Address {
      return requireAddress("ARC_ERC8183_JOBS");
    },
    get arcVaultFactory(): Address | undefined {
      return optionalAddress("ARC_VAULT_FACTORY");
    },
    /** Single-org fallback — see the matching comment on `getSepoliaAddresses`'s
     *  `mandateRegistrar`. Multi-org callers should read `arcVaultFactory`'s own `VaultCreated`
     *  events via `listVaults` instead. */
    get mandateAnchor(): Address | undefined {
      return optionalAddress("ARC_MANDATE_ANCHOR");
    },
    get agentTreasury(): Address | undefined {
      return optionalAddress("ARC_AGENT_TREASURY");
    },
  };
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
