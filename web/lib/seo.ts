import type { Metadata } from "next";
import { SITE_NAME, APP_URL, X_HANDLE } from "@mandate/ui/seo";

/**
 * The app's own metadata builder — deliberately separate from `landing/lib/seo.ts` rather than
 * shared, because the two behave differently in the one way that matters most: this one always
 * sets `robots: { index: false }`. The whole dashboard — an unbounded `/org/[orgEnsName]/*` URL
 * surface rendered client-side, crawlers see empty skeletons — is meant to stay out of search
 * entirely; only `runmandate.xyz` is meant to rank. Still fully crawlable (see `app/robots.ts`) so
 * that `noindex` is actually read rather than silently ignored, and still gets a complete
 * `openGraph`/`twitter` block so a shared dashboard link unfurls properly — indexing and link
 * unfurling are different problems, and noindex doesn't touch the second one.
 */
export interface AppMetadataInput {
  /** A plain string for most pages; the root layout passes its own `{default, template}` object
   *  here too — only `openGraph.title`/`twitter.title` need a plain string, computed below. */
  title: Metadata["title"];
  description: string;
}

function plainTitle(title: Metadata["title"]): string {
  if (typeof title === "string") return title;
  if (title && typeof title === "object" && "default" in title) return title.default;
  return SITE_NAME;
}

export function buildAppMetadata({ title, description }: AppMetadataInput): Metadata {
  const ogTitle = plainTitle(title);
  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description,
      url: APP_URL,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
    },
    // No `images` here — `opengraph-image.tsx` supplies `og:image`/`twitter:image` directly and
    // wins over anything set in code (Next's file-based metadata takes priority).
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      creator: X_HANDLE,
    },
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  };
}
