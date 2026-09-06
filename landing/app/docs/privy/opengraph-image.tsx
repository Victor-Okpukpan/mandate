import { ImageResponse } from "next/og";
import { OgCard, loadOgFonts } from "@mandate/ui/og";

export const alt = "Privy wallet policies for AI agents, and their limits";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

export default async function Image() {
  const fonts = await loadOgFonts();
  return new ImageResponse(
    <OgCard title="Privy policies, and their limits" subtitle="runmandate.xyz/docs/privy" cta="Read the docs →" />,
    { ...size, fonts },
  );
}
