import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";
import { AppNav } from "./_components/AppNav";

export const metadata: Metadata = {
  title: {
    default: "Observatory · MANDATE",
    template: "%s · MANDATE",
  },
  description: "The live authority graph — every agent mandate, its budget, and its status, in one view.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="bg-base text-primary font-sans antialiased">
        <Providers>
          <AppNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
