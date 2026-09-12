// Vendored from packages/shared/src/allowHuman.ts — duplicated, not imported, so this published
// package needs nothing from this monorepo. Keep in sync by hand if the source changes.
import type { Address } from "viem";

/**
 * `mandate.allow.human` is a mandate's display-only allowlist record — JSON, human-readable,
 * written once at issuance/amendment (`[{"target":"0x...","label":"ERC-8183 Jobs"}]`). It is also
 * the ONLY place that record is actually consumed rather than merely shown: parsing it back into a
 * recipient list is how an agent reconstructs the merkle proof for its own `allowlistRoot`, and
 * it's exactly the set the Enforcer must compile into the wallet's Privy policy (the `in` condition
 * on `payTo.to`) so the off-chain gate enforces the same allowlist as the on-chain one.
 *
 * Previously duplicated as a private function in agents/shared/src/tools.ts; centralised here so
 * the Enforcer, the agent runtimes, and the web app can never drift on this parse.
 */
export function parseAllowHuman(json: string): Address[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as Array<{ target: string }>;
    return parsed.map((entry) => entry.target as Address);
  } catch {
    return [];
  }
}
