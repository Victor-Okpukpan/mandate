import { ImageResponse } from "next/og";
import { OgCard, loadOgFonts } from "@mandate/ui/og";

export const alt = "Roadmap — what's next for MANDATE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image() {
  const fonts = await loadOgFonts();
  return new ImageResponse(
    <OgCard title="What's next for MANDATE" subtitle="runmandate.xyz/docs/roadmap" cta="Read the docs →" />,
    { ...size, fonts },
  );
}
