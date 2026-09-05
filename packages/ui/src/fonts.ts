/**
 * Shared type identity — two faces, two jobs, no overlap. There is no serif anywhere in this
 * system; an earlier revision tried one and it read as an editorial blog, not the infrastructure
 * console this product actually is.
 *
 *   DM Sans      every headline, every word a human reads, all UI chrome. A low-contrast
 *                geometric grotesk with a tall x-height — reads clean at both display size and
 *                13px table text, which matters because this is a dense, numeric dashboard.
 *   Geist Mono   every value that came off a chain — addresses, hashes, USDC amounts, ENS
 *                record keys, Privy policy rule names, countdowns. If it is machine-authored,
 *                it is mono.
 *
 * `next/font` must be called from within each Next.js app's own module graph (it's a build-time
 * macro, not a portable runtime import), so this file exports the shared CHOICE as plain data.
 * Each app's root layout instantiates the faces and applies the `.variable` classes to <html>;
 * `tokens.css` already points `--font-sans`/`--font-mono` at the variable names below, so as
 * long as every app uses these exact names, it's one design system and zero drift.
 */
export const FONT_VARIABLE_SANS = "--font-dm-sans";
export const FONT_VARIABLE_MONO = "--font-geist-mono";

/** Weights each app must request. */
export const FONT_WEIGHTS = {
  sans: ["400", "500", "700"],
} as const;
