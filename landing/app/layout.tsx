import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { InitTheme, ThemeProvider } from "@mandate/ui/components/Theme";
import { SITE_NAME, SITE_URL, REPO_URL, X_URL, DEFAULT_DESCRIPTION, BRAND } from "@mandate/ui/seo";

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
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "AI agent wallet",
    "AI agent payments",
    "agent spending limits",
    "ENS subnames",
    "onchain spending policy",
    "AI agent identity",
    "Privy wallet policy",
    "Arc chain",
  ],
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  authors: [{ name: "Victor Okpukpan", url: REPO_URL }],
  creator: "Victor Okpukpan",
  publisher: "Victor Okpukpan",
  category: "technology",
  // No explicit `icons`/`manifest` here — `app/icon.svg`, `app/apple-icon.tsx`, and
  // `app/manifest.ts` (file-based metadata) generate and link all three automatically, and
  // file-based metadata always wins over anything set in code, so setting it here too would be
  // dead, easily-inconsistent duplication.
  // No `images` here — `opengraph-image.tsx`/`twitter-image.tsx` (file-based metadata) supply
  // `og:image`/`twitter:image` directly and take priority over anything set in code.
  openGraph: {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    creator: "@victorokpukpan_",
  },
  alternates: { canonical: SITE_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: BRAND.bg },
    { media: "(prefers-color-scheme: light)", color: BRAND.bgLight },
  ],
  colorScheme: "dark light",
};

/**
 * `Organization`/`WebSite` JSON-LD — one identity claim per site, not per page (docs pages add
 * their own `TechArticle`/`BreadcrumbList` on top). No `aggregateRating`/`review`/invented
 * dates — a fabricated rating is a spam signal and a manual-action risk, not a shortcut.
 */
const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  sameAs: [REPO_URL, X_URL],
};

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: DEFAULT_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-base text-primary font-sans antialiased">
        {/* eslint-disable-next-line react/no-danger -- static, hand-authored JSON, no user input */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }} />
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }} />
        <InitTheme />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
