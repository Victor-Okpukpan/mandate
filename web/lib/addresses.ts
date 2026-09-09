import type { Address } from "viem";

/**
 * Client-side contract addresses. Next.js only inlines `NEXT_PUBLIC_`-prefixed env vars into the
 * browser bundle, so these are a deliberately separate set from `packages/shared/src/addresses.ts`
 * (server-side names, used by scripts and the Enforcer) rather than the same names re-exported —
 * the naming split IS the mechanism that keeps a server secret from ever reaching the client.
 */
export interface DeployedAddresses {
  /** The two platform factories — genuine chain singletons, one per MANDATE deployment. Present
   *  once `DeployFactories.s.sol` has run; every org is created through them, not env vars. See
   *  `packages/shared/src/orgs.ts`'s `listOrgs`/`listVaults`. */
  mandateOrgFactory?: Address;
  arcVaultFactory?: Address;
  /** NOT read from env here — this shape is reused by `useMandateDetail` for one specific org's
   *  own registrar/anchor/treasury, built from `useOrgs()`/`useSelectedOrg()` data by the caller.
   *  There is no single-org fallback anymore: an org's addresses come from factory logs or they
   *  don't exist to this app at all, the same rule `enforcer/src/orgSupervisor.ts` enforces. */
  mandateRegistrar?: Address;
  mandateAnchor?: Address;
  agentTreasury?: Address;
}

function readAddress(value: string | undefined): Address | undefined {
  if (!value) return undefined;
  return /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : undefined;
}

export function getDeployedAddresses(): Pick<DeployedAddresses, "mandateOrgFactory" | "arcVaultFactory"> {
  return {
    mandateOrgFactory: readAddress(process.env.NEXT_PUBLIC_MANDATE_ORG_FACTORY),
    arcVaultFactory: readAddress(process.env.NEXT_PUBLIC_ARC_VAULT_FACTORY),
  };
}
