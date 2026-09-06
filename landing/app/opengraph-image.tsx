import { ImageResponse } from "next/og";
import { OgCard, loadOgFonts } from "@mandate/ui/og";

export const alt = "MANDATE — ENS subnames as spending permissions for AI agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image() {
  const fonts = await loadOgFonts();
  return new ImageResponse(
    (
      <OgCard
        title="Revocable powers of attorney for AI agents."
        subtitle="ENS subnames are the permission. Arc is where they spend."
        cta="Launch app →"
      />
    ),
    { ...size, fonts },
  );
}
