import { ImageResponse } from "next/og";
import { OgCard, loadOgFonts } from "@mandate/ui/og";

export const alt = "MANDATE — every agent mandate, live";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image() {
  const fonts = await loadOgFonts();
  return new ImageResponse(
    (
      <OgCard
        title="Every agent mandate, live."
        subtitle="Budget, status, and enforcement — read from Sepolia, Privy, and Arc."
        cta="Sign in →"
      />
    ),
    { ...size, fonts },
  );
}
