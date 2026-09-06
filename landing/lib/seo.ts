import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION, X_HANDLE } from "@mandate/ui/seo";

/**
 * Builds a COMPLETE metadata object for every page that calls it — every field below is set on
 * every call, never partially. Next's metadata merge is shallow (a child segment's `openGraph`
 * REPLACES the parent's wholesale, not field-by-field), so a docs page that only set
 * `openGraph: { title }` would silently erase the root layout's `siteName`/`type`/`url`. Calling
 * this instead of hand-writing a partial object per page is what prevents that.
 *
 * File-based metadata (`opengraph-image.tsx`) still wins over anything set here — deliberately no
 * `openGraph.images`/`twitter.images` anywhere in this file; Next fills those in from the file
 * convention.
 */
export interface PageMetadataInput {
  title: string;
  description: string;
  /** Path from the site root, e.g. "/docs/ens". "/" for the home page. */
  path: string;
  /** Defaults to indexable — every docs page is meant to rank. Set `false` for /docs/demo. */
  index?: boolean;
}

export function buildMetadata({ title, description, path, index = true }: PageMetadataInput): Metadata {
  const url = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      locale: "en_US",
    },
    // No `images` here on purpose — `opengraph-image.tsx`/`twitter-image.tsx` (file-based
    // metadata) supply `og:image`/`twitter:image` directly and take priority over anything set
    // in code; setting it here too would just be dead, easily-inconsistent duplication.
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: X_HANDLE,
    },
    robots: index
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } }
      : { index: false, follow: true },
  };
}

export { SITE_NAME, SITE_URL, DEFAULT_DESCRIPTION };
