import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BRAND, SITE_NAME } from "./seo";

/**
 * Loads the vendored static-instance DM Sans TTFs (`packages/ui/assets/`) for `ImageResponse`'s
 * `fonts` option. Static, not the variable font next/font/google normally serves elsewhere in
 * both apps — Satori (what `ImageResponse` renders through) handles variable fonts poorly, and
 * only `ttf`/`otf`/`woff` are supported at all. `process.cwd()` is each Next app's own root
 * (`landing/` or `web/`) at build/request time, and both sit one level below `packages/ui/` in
 * the same monorepo, so the relative path resolves identically from either caller.
 */
export async function loadOgFonts() {
  const assetsDir = join(process.cwd(), "../packages/ui/assets");
  const [regular, bold] = await Promise.all([
    readFile(join(assetsDir, "DMSans-Regular.ttf")),
    readFile(join(assetsDir, "DMSans-Bold.ttf")),
  ]);
  return [
    { name: "DM Sans", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "DM Sans", data: bold, weight: 700 as const, style: "normal" as const },
  ];
}

/**
 * The shared OG/Twitter card layout, rendered by both apps' `opengraph-image.tsx`/
 * `twitter-image.tsx` files via `next/og`'s `ImageResponse`. A plain function returning a JSX
 * tree — not a real component (no hooks, no "use client") — because Satori (what `ImageResponse`
 * renders through) supports only flexbox and a subset of CSS, and does not resolve CSS custom
 * properties at all, so every color here is `BRAND`'s literal hex, never `var(--accent)`.
 *
 * Reproduces the site's own mint-grid texture and the `LogoMark` glyph inline (Satori has no
 * access to `packages/ui/src/components/Logo.tsx`'s CSS-var-driven SVG, so the mark is
 * re-expressed here in literal brand colors) rather than introducing a second, drifting design.
 */
export interface OgCardProps {
  title: string;
  subtitle: string;
  /** A short, action-oriented label rendered as a filled pill — "Launch app →", "Read the docs
   *  →". Scanners like opengraph.xyz flag an OG image with no call-to-action text baked into the
   *  pixels themselves (a meta description doesn't count); this is what answers that, and doubles
   *  as a real visual anchor in the bottom-right corner rather than empty space. */
  cta?: string;
}

export function OgCard({ title, subtitle, cta = "runmandate.xyz" }: OgCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        backgroundColor: BRAND.bg,
        backgroundImage:
          `linear-gradient(${BRAND.accent}14 1px, transparent 1px), ` +
          `linear-gradient(90deg, ${BRAND.accent}14 1px, transparent 1px)`,
        backgroundSize: "64px 64px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: BRAND.accentSubtle,
            border: `2px solid ${BRAND.accent}`,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 20 20" fill="none">
            <path
              d="M6 14.5V6.2l4 4.1 4-4.1v8.3"
              stroke={BRAND.accent}
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span style={{ fontFamily: "DM Sans", fontWeight: 700, fontSize: 26, color: BRAND.textPrimary, letterSpacing: -0.5 }}>
          {SITE_NAME}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 920 }}>
        <span
          style={{
            fontFamily: "DM Sans",
            fontWeight: 700,
            fontSize: 56,
            lineHeight: 1.15,
            letterSpacing: -1.5,
            color: BRAND.textPrimary,
          }}
        >
          {title}
        </span>
        <div style={{ display: "flex", width: 64, height: 4, backgroundColor: BRAND.accent, borderRadius: 2 }} />
        <span style={{ fontFamily: "DM Sans", fontWeight: 400, fontSize: 26, color: BRAND.textSecondary }}>
          {subtitle}
        </span>
      </div>

      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 26px",
            borderRadius: 10,
            backgroundColor: BRAND.accent,
          }}
        >
          <span style={{ fontFamily: "DM Sans", fontWeight: 700, fontSize: 22, color: BRAND.bg }}>{cta}</span>
        </div>
      </div>
    </div>
  );
}
