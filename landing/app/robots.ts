import type { MetadataRoute } from "next";
import { SITE_URL } from "@mandate/ui/seo";

/**
 * Naming a user-agent creates a group that REPLACES the `*` group for that agent, not one that
 * adds to it — so every AI crawler listed here needs its own explicit `allow: "/"`, or it would
 * get no rules at all instead of inheriting the wildcard's. `Google-Extended` only governs
 * Gemini's training/grounding corpus; it has no effect on Google's own AI Overviews, which crawl
 * as ordinary Googlebot and are covered by the `*` rule already.
 */
export default function robots(): MetadataRoute.Robots {
  const aiAgents = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-User",
    "Claude-SearchBot",
    "PerplexityBot",
    "Perplexity-User",
    "Google-Extended",
    "Applebot-Extended",
    "meta-externalagent",
    "cohere-ai",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...aiAgents.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
