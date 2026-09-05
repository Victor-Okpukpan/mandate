import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { InitTheme, ThemeProvider } from "@mandate/ui/components/Theme";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MANDATE — Revocable powers of attorney for AI agents",
    template: "%s · MANDATE",
  },
  description:
    "ENS subnames are revocable powers of attorney for AI agents. Arc is where they spend.",
  metadataBase: new URL("https://runmandate.xyz"),
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "MANDATE",
    description:
      "ENS subnames are revocable powers of attorney for AI agents. Arc is where they spend.",
    type: "website",
  },
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
