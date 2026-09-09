"use client";

import { use, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useAccount, useWriteContract } from "wagmi";
import { sepolia } from "viem/chains";
import type { Hex } from "viem";
import { MandateRegistrarAbi } from "@mandate/shared/abis";
import { Drawer } from "@mandate/ui/components/Drawer";
import { Display, Eyebrow, Lede } from "@mandate/ui/components/Type";
import { Stat } from "@mandate/ui/components/Stat";
import { Card } from "@mandate/ui/components/Card";
import { SkeletonRows } from "@mandate/ui/components/Skeleton";
import { fadeUp } from "@mandate/ui/lib/motion";
import type { OrgWithVault } from "@mandate/shared/orgs";
import { useSelectedOrg } from "@/lib/useSelectedOrg";
import { mandateStateOf, useMandateGraph } from "@/lib/useMandateGraph";
import { useMandateLabels } from "@/lib/useMandateLabels";
import { useAdversaryAttempts } from "@/lib/useAdversaryAttempts";
import { useIsOrgAdmin } from "@/lib/useIsOrgAdmin";
import { MandateTree } from "@/app/_components/MandateTree";
import { MandateDetailPanel } from "@/app/_components/MandateDetailPanel";
import { OrgNotFound } from "@/app/_components/OrgNotFound";

/**
 * The org's own operations view — everything that used to live at `/` before orgs existed.
 * Addresses come from `org` (the factory's own events, or the single-org fallback resolved
 * on-chain), never from a global env constant: two org tabs open side by side must never read
 * each other's registrar.
 */
/**
 * The adversary agent's own escape-attempts log, surfaced directly — see
 * `web/app/api/adversary/attempts/route.ts`'s NatSpec for what this is and isn't. Renders nothing
 * when the log isn't reachable (a deployment with no adversary process running at all, e.g.
 * production), rather than a misleading "0 attempts" that could read as "0 vulnerabilities."
 */
function AdversaryPanel() {
  const { data, loading } = useAdversaryAttempts();
  if (loading || !data?.available || data.total === 0) return null;

  const clean = data.succeeded === 0;
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.09 }} className="mt-6">
      <Card padding="lg">
        <div className="flex items-center justify-between gap-6">
          <div className="grid grid-cols-3 gap-8">
            <Stat label="Escape attempts" value={data.total} />
            <Stat label="Succeeded" value={data.succeeded} />
            <Stat label="Blocked" value={data.blocked} />
          </div>
          <span className={`shrink-0 font-mono text-[11px] uppercase tracking-label ${clean ? "text-live" : "text-revoked"}`}>
            {clean ? "none succeeded" : "review needed"}
          </span>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-tertiary">
          A red-team agent attacking its own mandate — an exploratory fuzz over paths a human
          wouldn&rsquo;t think to try, not a formal proof. The Foundry invariant suite is the actual
          proof; this is a demonstration.
        </p>
      </Card>
    </motion.div>
  );
}

function OrgOverview({ org }: { org: OrgWithVault }) {
  const { nodes, loading } = useMandateGraph(org.registrar, org.createdAtBlock);
  const labels = useMandateLabels(
    useMemo(() => nodes.map((n) => n.node), [nodes]),
    org.registrar,
  );
  const { writeContract, isPending } = useWriteContract();
  const { isConnected } = useAccount();
  const { isAdmin } = useIsOrgAdmin(org.registrar);
  const [selected, setSelected] = useState<Hex | null>(null);
  const [revokingNode, setRevokingNode] = useState<Hex | null>(null);
  const now = Math.floor(Date.now() / 1000);

  const counts = useMemo(() => {
    const c = { live: 0, expiring: 0, revoked: 0, stale: 0 };
    for (const n of nodes) c[mandateStateOf(n, now)] += 1;
    return c;
  }, [nodes, now]);

  const selectedNode = selected ? (nodes.find((n) => n.node === selected) ?? null) : null;

  function handleRevoke(node: Hex) {
    setRevokingNode(node);
    writeContract({
      address: org.registrar,
      abi: MandateRegistrarAbi,
      functionName: "revokeMandate",
      args: [node, ("0x" + "0".repeat(64)) as Hex],
      chainId: sepolia.id,
    });
  }

  const detailAddresses = {
    mandateRegistrar: org.registrar,
    mandateAnchor: org.vault?.anchor,
    agentTreasury: org.vault?.treasury,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Eyebrow>Authority plane · Sepolia</Eyebrow>
        <Display as="h1" size="md" className="mt-2">
          Every mandate, live.
        </Display>
        <Lede className="mt-3">
          Read directly from {org.orgEnsName}&rsquo;s own event log — nothing here is cached or
          indexed. Select a row to see its ENS records, its Arc anchor, and what it&rsquo;s spent.
        </Lede>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.06 }}
        className="mt-10"
      >
        <Card padding="lg">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <Stat label="Live" value={counts.live} />
            <Stat label="Expiring" value={counts.expiring} />
            <Stat label="Revoked" value={counts.revoked} />
            <Stat label="Total issued" value={nodes.length} />
          </div>
        </Card>
      </motion.div>

      <AdversaryPanel />

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.12 }}
        className="mt-6"
      >
        <Card padding="lg">
          {loading ? (
            <SkeletonRows rows={5} />
          ) : nodes.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[14px] font-medium text-primary">No mandates issued yet</p>
              <p className="mt-2 text-[13px] text-tertiary">
                {isConnected ? "Issue the first one from " : "Sign in and issue the first one from "}
                <span className="font-mono text-secondary">mandate/new</span>.
              </p>
            </div>
          ) : (
            <MandateTree
              nodes={nodes}
              labels={labels}
              selectedNode={selected ?? undefined}
              onSelect={setSelected}
              orgEnsName={org.orgEnsName}
              registrar={org.registrar}
            />
          )}
        </Card>
      </motion.div>

      <Drawer
        open={Boolean(selectedNode)}
        onClose={() => setSelected(null)}
        title={<Eyebrow>Mandate detail</Eyebrow>}
      >
        {selectedNode ? (
          <MandateDetailPanel
            node={selectedNode.node}
            state={mandateStateOf(selectedNode, now)}
            addresses={detailAddresses}
            onRevoke={isAdmin ? () => handleRevoke(selectedNode.node) : undefined}
            revoking={revokingNode === selectedNode.node && isPending}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

export default function OrgOverviewPage({ params }: { params: Promise<{ orgEnsName: string }> }) {
  const { orgEnsName } = use(params);
  const { org, loading, notFound } = useSelectedOrg(decodeURIComponent(orgEnsName));

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <SkeletonRows rows={5} />
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

  return <OrgOverview org={org} />;
}
