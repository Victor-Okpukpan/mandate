import type { MetadataRoute } from "next";

/**
 * Crawlable on purpose, not blocked — every page here also carries `robots: { index: false }`
 * (see `lib/seo.ts`), and a `Disallow` here would stop a crawler from ever fetching a page far
 * enough to read that `noindex` tag at all. Blocking would leave already-known URLs sitting in
 * results as bare, untitled links forever instead of actually dropping out of the index. Only
 * `/api/*` is disallowed — pure JSON, nothing for any crawler to do there. No sitemap: nothing
 * under this subdomain is meant to be indexed, so there is nothing to submit.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
  };
}
