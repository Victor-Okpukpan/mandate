import { ImageResponse } from "next/og";
import { OgCard, loadOgFonts } from "@mandate/ui/og";

export const alt = "Architecture: authority, enforcement, and money planes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image() {
  const fonts = await loadOgFonts();
  return new ImageResponse(
    <OgCard title="Authority, enforcement, money" subtitle="runmandate.xyz/docs/architecture" cta="Read the docs →" />,
    { ...size, fonts },
  );
}
