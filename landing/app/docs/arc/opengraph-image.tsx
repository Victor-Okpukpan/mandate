import { ImageResponse } from "next/og";
import { OgCard, loadOgFonts } from "@mandate/ui/og";

export const alt = "Arc: USDC-gas payments for autonomous agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image() {
  const fonts = await loadOgFonts();
  return new ImageResponse(
    <OgCard title="USDC-gas payments for agents" subtitle="runmandate.xyz/docs/arc" />,
    { ...size, fonts },
  );
}
