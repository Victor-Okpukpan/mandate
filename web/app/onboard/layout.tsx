import type { Metadata } from "next";
import { buildAppMetadata } from "../../lib/seo";

/**
 * A server layout wrapping a client page — `web/app/onboard/page.tsx` is `"use client"`, and
 * `metadata`/`generateMetadata` are server-component-only exports. This is what finally makes the
 * root layout's `title.template` live for this route instead of every page in the app resolving
 * to the identical default title.
 */
export const metadata: Metadata = buildAppMetadata({
  title: "Create an organisation",
  description: "Register your org's ENS root and Arc vault — the first step before issuing any mandate.",
});

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
