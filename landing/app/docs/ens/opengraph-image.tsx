import { ImageResponse } from "next/og";
import { OgCard, loadOgFonts } from "@mandate/ui/og";

export const alt = "ENS subnames as AI agent permissions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image() {
  const fonts = await loadOgFonts();
  return new ImageResponse(
    <OgCard title="ENS subnames as agent permissions" subtitle="runmandate.xyz/docs/ens" cta="Read the docs →" />,
    { ...size, fonts },
  );
}
