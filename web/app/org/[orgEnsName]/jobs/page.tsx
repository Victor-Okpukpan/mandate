"use client";

import { use } from "react";
import type { Address } from "viem";
import { fromErc20Usdc } from "@mandate/shared/decimals";
import { Card } from "@mandate/ui/components/Card";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { Display, Eyebrow, Lede } from "@mandate/ui/components/Type";
import { Stat } from "@mandate/ui/components/Stat";
import { Table, TableWrap, Td, Th, Tr } from "@mandate/ui/components/Table";
import { SkeletonRows } from "@mandate/ui/components/Skeleton";
import { useSelectedOrg } from "@/lib/useSelectedOrg";
import { JOB_STATUS_LABEL, useJobsFeed } from "@/lib/useJobsFeed";
import { OrgNotFound } from "@/app/_components/OrgNotFound";
import { NotDeployed } from "@/app/_components/NotDeployed";

const STATUS_COLOR: Record<number, string> = {
  0: "text-tertiary", // Open
  1: "text-live", // Funded
  2: "text-live", // Submitted
  3: "text-live", // Completed
  4: "text-revoked", // Rejected
  5: "text-stale", // Expired
};

/**
 * A real per-job feed, scoped to this org's own `AgentTreasury.JobCreated` log — see
 * `useJobsFeed.ts`'s NatSpec for why that, not the shared Jobs contract's own `jobCounter`, is the
 * right scope. Previously this page showed only the pool-wide job count because `getJob`'s return
 * shape hadn't been independently confirmed; it now has, against the real verified source on
 * Arcscan (see `contracts/src/interfaces/IERC8183Jobs.sol`).
 */
function JobsView({ treasury, vaultCreatedAtBlock }: { treasury: Address; vaultCreatedAtBlock: bigint }) {
  const { rows, loading } = useJobsFeed(treasury, vaultCreatedAtBlock);

  const openCount = rows.filter((r) => r.status === 0).length;
  const activeCount = rows.filter((r) => r.status === 1 || r.status === 2).length;
  const completedCount = rows.filter((r) => r.status === 3).length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <Eyebrow>Money plane · Arc testnet</Eyebrow>
      <Display as="h1" size="sm" className="mt-2">
        Jobs
      </Display>
      <Lede className="mt-3">
        ERC-8183 job escrow — funded from the treasury, delivered, settled, reputation written by a
        distinct evaluator. Never the vendor grading its own work.
      </Lede>

      <Card padding="lg" className="mt-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <Stat label="Open" value={openCount} />
          <Stat label="Funded / submitted" value={activeCount} />
          <Stat label="Completed" value={completedCount} />
          <Stat label="Total created" value={rows.length} />
        </div>
      </Card>

      <Card padding="lg" className="mt-6">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[14px] font-medium text-primary">No jobs created yet</p>
            <p className="mt-2 text-[13px] text-tertiary">
              An agent creates one via{" "}
              <span className="font-mono text-secondary">treasury.createJob(...)</span>.
            </p>
          </div>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Job</Th>
                  <Th>Agent</Th>
                  <Th>Provider</Th>
                  <Th>Budget</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.jobId.toString()}>
                    <Td className="tnum text-secondary">#{row.jobId.toString()}</Td>
                    <Td>
                      <MonoValue value={row.agent} className="text-secondary" />
                    </Td>
                    <Td>
                      <MonoValue value={row.provider} className="text-secondary" />
                    </Td>
                    <Td className="tnum text-secondary">
                      {row.budget > 0n ? `$${fromErc20Usdc(row.budget)}` : "—"}
                    </Td>
                    <Td>
                      <span className={`font-mono text-[12px] ${STATUS_COLOR[row.status] ?? "text-tertiary"}`}>
                        {JOB_STATUS_LABEL[row.status] ?? "Unknown"}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="mt-6 max-w-[62ch] text-[13px] leading-relaxed text-tertiary">
        Every row reads live from the real deployed ERC-8183 contract on Arc — no indexer, nothing
        cached server-side. Job creation and funding go through the treasury (
        <span className="font-mono text-secondary">createJob</span>,{" "}
        <span className="font-mono text-secondary">fundJob</span>) so every spend is still checked
        against the mandate the same way a direct payment is.
      </p>
    </div>
  );
}

export default function JobsPage({ params }: { params: Promise<{ orgEnsName: string }> }) {
  const { orgEnsName } = use(params);
  const decoded = decodeURIComponent(orgEnsName);
  const { org, loading, notFound } = useSelectedOrg(decoded);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <SkeletonRows rows={4} />
      </div>
    );
  }

  if (notFound || !org) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6">
        <OrgNotFound orgEnsName={decoded} />
      </div>
    );
  }

  if (!org.vault) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <NotDeployed what={`${org.orgEnsName}'s Arc vault`} />
      </div>
    );
  }

  return <JobsView treasury={org.vault.treasury} vaultCreatedAtBlock={org.vault.createdAtBlock} />;
}
