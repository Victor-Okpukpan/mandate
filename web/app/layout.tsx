import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { InitTheme, ThemeProvider } from "@mandate/ui/components/Theme";
import { APP_URL, BRAND } from "@mandate/ui/seo";
import { buildAppMetadata } from "../lib/seo";
import { Providers } from "./providers";
import { AppShell } from "./_components/AppShell";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  // Relative OG paths below need this — its absence would be a build error, not a warning.
  metadataBase: new URL(APP_URL),
  ...buildAppMetadata({
    title: { default: "Every agent mandate, live — MANDATE", template: "%s · MANDATE" },
    description:
      "Every agent mandate, its budget, and its status, read live from Sepolia, Privy, and Arc.",
  }),
};

export const viewport: Viewport = {
  themeColor: BRAND.bg,
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-base text-primary font-sans antialiased">
        <InitTheme />
        <ThemeProvider>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
