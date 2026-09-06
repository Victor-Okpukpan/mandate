import type { Metadata } from "next";
import { buildAppMetadata } from "../../../lib/seo";

/**
 * A server layout wrapping every client page under `/org/[orgEnsName]/*` — same reasoning as
 * `web/app/onboard/layout.tsx`. `params` is a Promise in Next 16's async request APIs, so it must
 * be awaited before use. Reading the org name straight from the URL segment (not resolved against
 * live chain data) is a deliberate, cheap choice: it's already exactly what the visitor typed or
 * clicked, and this only needs to produce a readable tab title/share-card, not validate the org
 * exists — `useSelectedOrg` further down the tree still does that and renders `OrgNotFound`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgEnsName: string }>;
}): Promise<Metadata> {
  const { orgEnsName } = await params;
  const name = decodeURIComponent(orgEnsName);
  return buildAppMetadata({
    title: name,
    description: `${name}'s mandates, treasury, and jobs — read live from Sepolia, Privy, and Arc.`,
  });
}

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return children;
}
