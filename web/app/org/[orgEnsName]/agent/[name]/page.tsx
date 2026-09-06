"use client";

import { use } from "react";
import type { Hex } from "viem";
import type { OrgWithVault } from "@mandate/shared/orgs";
import { Eyebrow } from "@mandate/ui/components/Type";
import { SkeletonRows } from "@mandate/ui/components/Skeleton";
import { useSelectedOrg } from "@/lib/useSelectedOrg";
import { mandateStateOf, useMandateGraph } from "@/lib/useMandateGraph";
import { MandateDetailPanel } from "@/app/_components/MandateDetailPanel";
import { OrgNotFound } from "@/app/_components/OrgNotFound";

/**
 * Standalone deep link to a single mandate — the same `MandateDetailPanel` the tree's drawer
 * renders inline, at its own URL, so a mandate can be shared or bookmarked directly.
 */
export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ orgEnsName: string; name: string }>;
}) {
  const { orgEnsName, name } = use(params);
  const node = name as Hex;
  const { org, loading, notFound } = useSelectedOrg(decodeURIComponent(orgEnsName));

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  if (notFound || !org) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6">
        <OrgNotFound orgEnsName={decodeURIComponent(orgEnsName)} />
      </div>
    );
  }

  return <AgentDetailInner node={node} org={org} />;
}

function AgentDetailInner({ node, org }: { node: Hex; org: OrgWithVault }) {
  const { nodes } = useMandateGraph(org.registrar);
  const now = Math.floor(Date.now() / 1000);
  const match = nodes.find((n) => n.node === node);
  const state = match ? mandateStateOf(match, now) : "stale";

  const detailAddresses = {
    mandateRegistrar: org.registrar,
    mandateAnchor: org.vault?.anchor,
    agentTreasury: org.vault?.treasury,
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
      <Eyebrow>Mandate detail</Eyebrow>
      <div className="mt-6">
        <MandateDetailPanel node={node} state={state} addresses={detailAddresses} />
      </div>
    </div>
  );
}
