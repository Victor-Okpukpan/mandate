/**
 * Plain string SEO/brand data — no `next` types, so both apps' server-only metadata code and any
 * client component can import it freely. Mirrors `fonts.ts`'s own reasoning: `next/font` and
 * `Metadata` are both build-time/server-only contracts that can't cross the workspace boundary as
 * live objects, so the underlying facts are shared as data instead, and each app's own
 * `lib/seo.ts` builds its typed `Metadata` object from these.
 */

export const SITE_NAME = "MANDATE";
export const SITE_URL = "https://runmandate.xyz";
export const APP_URL = "https://app.runmandate.xyz";
export const REPO_URL = "https://github.com/victor-okpukpan/mandate";
export const X_HANDLE = "@victorokpukpan_";
export const X_URL = "https://x.com/victorokpukpan_";

/** The root layout's own description — see each docs page for its own, more specific one. */
export const DEFAULT_DESCRIPTION =
  "ENS subnames are revocable powers of attorney for AI agents. Arc is where they spend.";

/** Alt text for the generated OG/Twitter card image — describes the card itself, not the page. */
export const OG_ALT = "MANDATE — ENS subnames as spending permissions for AI agents";

/** The exact brand pairing from `tokens.css`'s dark palette — the canonical OG-image ground. */
export const BRAND = {
  bg: "#080a09",
  bgLight: "#fafbfa",
  accent: "#12ff80",
  accentSubtle: "#0a2a1a",
  textPrimary: "#f2f6f4",
  textSecondary: "#8a9691",
} as const;
