import { ImageResponse } from "next/og";
import { BRAND } from "@mandate/ui/seo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const runtime = "nodejs";

/**
 * Code-generated rather than a binary asset, so the iOS home-screen icon can never drift from the
 * brand tokens. Before this, iOS had nothing to fall back to but a screenshot of the page — there
 * was no `apple-icon`/`apple-touch-icon` at all, only the 332-byte SVG favicon.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: BRAND.accentSubtle,
        }}
      >
        <svg width="96" height="96" viewBox="0 0 20 20" fill="none">
          <path
            d="M6 14.5V6.2l4 4.1 4-4.1v8.3"
            stroke={BRAND.accent}
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
