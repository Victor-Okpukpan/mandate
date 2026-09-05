"use client";

import { use } from "react";
import type { Hex } from "viem";
import { Eyebrow } from "@mandate/ui/components/Type";
import { getDeployedAddresses, isDeployed } from "../../../lib/addresses";
import { mandateStateOf, useMandateGraph } from "../../../lib/useMandateGraph";
import { MandateDetailPanel } from "../../_components/MandateDetailPanel";
import { NotDeployed } from "../../_components/NotDeployed";

/**
 * Standalone deep link to a single mandate — the same `MandateDetailPanel` the tree's drawer
 * renders inline, at its own URL, so a mandate can be shared or bookmarked directly.
 */
export default function AgentDetailPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const node = name as Hex;
  const addresses = getDeployedAddresses();

  if (!isDeployed(addresses, ["mandateRegistrar"])) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <NotDeployed what="MandateRegistrar" />
      </div>
    );
  }

  return <AgentDetailInner node={node} addresses={addresses} />;
}

function AgentDetailInner({
  node,
  addresses,
}: {
  node: Hex;
  addresses: ReturnType<typeof getDeployedAddresses>;
}) {
  const { nodes } = useMandateGraph(addresses.mandateRegistrar);
  const now = Math.floor(Date.now() / 1000);
  const match = nodes.find((n) => n.node === node);
  const state = match ? mandateStateOf(match, now) : "stale";

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
      <Eyebrow>Mandate detail</Eyebrow>
      <div className="mt-6">
        <MandateDetailPanel node={node} state={state} addresses={addresses} />
      </div>
    </div>
  );
}
