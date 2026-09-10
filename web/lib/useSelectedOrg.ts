"use client";

import { useOrgs } from "./useOrgs";
import type { OrgWithVault } from "@mandate/shared/orgs";

/**
 * Resolves the `[orgEnsName]` route segment against the org directory `useOrgs()` already reads.
 * Every org-scoped page (`/org/[orgEnsName]/...`) calls this once instead of re-deriving
 * addresses from env vars — the org's registrar/anchor/treasury come from its own `OrgCreated`/
 * `VaultCreated` logs (or the single-org fallback), never from a global constant, so two org tabs
 * open side by side never fight over which org's addresses are "the" addresses.
 */
export function useSelectedOrg(orgEnsName: string): {
  org: OrgWithVault | undefined;
  loading: boolean;
  notFound: boolean;
  /** A clean vault read landed — safe to treat a missing `org.vault` as "not set up". */
  vaultsConfirmed: boolean;
} {
  const { orgs, loading, vaultsConfirmed } = useOrgs();
  const org = orgs.find((o) => o.orgEnsName === orgEnsName);
  return { org, loading, notFound: !loading && !org, vaultsConfirmed };
}
