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
    mandateRegistrar: readAddress(process.env.NEXT_PUBLIC_MANDATE_REGISTRAR),
    mandateAnchor: readAddress(process.env.NEXT_PUBLIC_MANDATE_ANCHOR),
    agentTreasury: readAddress(process.env.NEXT_PUBLIC_AGENT_TREASURY),
  };
}

export function isDeployed(addresses: DeployedAddresses): boolean {
  return Boolean(addresses.mandateRegistrar && addresses.mandateAnchor && addresses.agentTreasury);
}
