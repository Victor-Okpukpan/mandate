import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://runmandate.xyz"),
  title: {
    default: "MANDATE — revocable authority for AI agents",
    template: "%s · MANDATE",
  },
  description:
    "ENS subnames are revocable powers of attorney for AI agents. Arc is where they spend.",
  openGraph: {
    title: "MANDATE",
    description: "ENS subnames are revocable powers of attorney for AI agents. Arc is where they spend.",
    url: "https://runmandate.xyz",
    siteName: "MANDATE",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-base text-primary font-sans antialiased">{children}</body>
    </html>
  );
}
