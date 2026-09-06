import { ImageResponse } from "next/og";
import { OgCard, loadOgFonts } from "@mandate/ui/og";

export const alt = "MANDATE — live demo walkthrough";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image() {
  const fonts = await loadOgFonts();
  return new ImageResponse(
    <OgCard title="Live demo walkthrough" subtitle="runmandate.xyz/docs/demo" cta="Read the docs →" />,
    { ...size, fonts },
  );
}
