import type { Address } from "viem";

/**
 * Client-side contract addresses. Next.js only inlines `NEXT_PUBLIC_`-prefixed env vars into the
 * browser bundle, so these are a deliberately separate set from `packages/shared/src/addresses.ts`
 * (server-side names, used by scripts and the Enforcer) rather than the same names re-exported —
 * the naming split IS the mechanism that keeps a server secret from ever reaching the client.
 *
 * Unlike the server-side loader, this one never throws: MandateRegistrar/MandateAnchor/
 * AgentTreasury genuinely don't exist until deployed, and the observatory needs to render a clear
 * "not yet deployed" state rather than crash the whole app on a missing env var.
 */
export interface DeployedAddresses {
  /** The two platform factories — genuine chain singletons, one per MANDATE deployment. Present
   *  once `DeployFactories.s.sol` has run; every org after that is created through them, not env
   *  vars. See `packages/shared/src/orgs.ts`'s `listOrgs`/`listVaults`. */
  mandateOrgFactory?: Address;
  arcVaultFactory?: Address;
  /** Single-org fallback — whatever one run of the onboarding flow (wizard or manual factory
   *  calls) produced. Lets pages keep working before org selection reads factory logs
   *  everywhere; new code should prefer `useOrgs()`/`useSelectedOrg()` over these three. */
  mandateRegistrar?: Address;
  mandateAnchor?: Address;
  agentTreasury?: Address;
}

function readAddress(value: string | undefined): Address | undefined {
  if (!value) return undefined;
  return /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : undefined;
}

export function getDeployedAddresses(): DeployedAddresses {
  return {
    mandateOrgFactory: readAddress(process.env.NEXT_PUBLIC_MANDATE_ORG_FACTORY),
    arcVaultFactory: readAddress(process.env.NEXT_PUBLIC_ARC_VAULT_FACTORY),
    mandateRegistrar: readAddress(process.env.NEXT_PUBLIC_MANDATE_REGISTRAR),
    mandateAnchor: readAddress(process.env.NEXT_PUBLIC_MANDATE_ANCHOR),
    agentTreasury: readAddress(process.env.NEXT_PUBLIC_AGENT_TREASURY),
  };
}

/**
 * Checks only the addresses a given page actually needs — not all three. A page that only reads
 * `MandateRegistrar` (the graph, the composer, the agent triptych) shouldn't show "not deployed"
 * just because `AgentTreasury` hasn't gone out yet, and shouldn't blame the wrong contract when it
 * does.
 */
export function isDeployed(
  addresses: DeployedAddresses,
  required: Array<keyof DeployedAddresses> = ["mandateRegistrar", "mandateAnchor", "agentTreasury"],
): boolean {
  return required.every((key) => Boolean(addresses[key]));
}
