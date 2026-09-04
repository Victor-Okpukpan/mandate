/**
 * Shared font identity — Geist Sans + Geist Mono, self-hosted via the `geist` package.
 *
 * `next/font` must be called from within each Next.js app's own module graph (it's a build-time
 * macro, not a portable runtime import), so this file exports the shared CHOICE — which faces,
 * which weights — as plain data. Each app's root layout imports `GeistSans`/`GeistMono` from
 * `geist/font/sans` / `geist/font/mono` directly and applies `.variable` to <html>; `tokens.css`
 * already points `--font-sans`/`--font-mono` at `--font-geist-sans`/`--font-geist-mono`, so as
 * long as both apps use these exact variable names, one design system, two apps, zero drift.
 *
 * Why Geist: built for dense, numeric, technical UI — proportional figures by default and a
 * matching mono for every address, hash, and countdown, not a generic system-font fallback.
 */
export const FONT_VARIABLE_SANS = "--font-geist-sans";
export const FONT_VARIABLE_MONO = "--font-geist-mono";
