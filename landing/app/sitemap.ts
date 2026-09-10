import type { MetadataRoute } from "next";
import { SITE_URL } from "@mandate/ui/seo";

/**
 * `/docs/demo` is deliberately excluded — it's a presenter's run-of-show for a live walkthrough,
 * already unlinked from the footer (see `Footer.tsx`'s own comment) and `noindex`'d in its own
 * metadata; listing it here would contradict that.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const docs = ["architecture", "ens", "privy", "arc", "security", "roadmap"].map((slug) => ({
    url: `${SITE_URL}/docs/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/docs`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    ...docs,
  ];
}
