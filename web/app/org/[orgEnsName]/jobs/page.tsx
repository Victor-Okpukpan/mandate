"use client";

import { useReadContract } from "wagmi";
import { arcTestnet } from "viem/chains";
import type { Address } from "viem";
import { JobsAbi } from "@mandate/shared/abis";
import { Card } from "@mandate/ui/components/Card";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { Display, Eyebrow, Lede } from "@mandate/ui/components/Type";
import { Stat } from "@mandate/ui/components/Stat";

const JOBS_ADDRESS = (process.env.NEXT_PUBLIC_ARC_ERC8183_JOBS ??
  "0x0747EEf0706327138c69792bF28Cd525089e4583") as Address;
const EXPLORER = "https://testnet.arcscan.app/address";

export default function JobsPage() {
  const { data: jobCount, isLoading } = useReadContract({
    address: JOBS_ADDRESS,
    abi: JobsAbi,
    functionName: "jobCounter",
    chainId: arcTestnet.id,
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <Eyebrow>Money plane · Arc testnet</Eyebrow>
      <Display as="h1" size="sm" className="mt-2">
        Jobs
      </Display>
      <Lede className="mt-3">
        ERC-8183 job escrow — funded from the treasury, delivered, settled, reputation written by
        a distinct evaluator. Never the vendor grading its own work.
      </Lede>

      <Card padding="lg" className="mt-8">
        <div className="flex items-center justify-between gap-6">
          <Stat label="Total jobs created" value={isLoading ? "…" : (jobCount?.toString() ?? "—")} />
          <a
            href={`${EXPLORER}/${JOBS_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[13px] text-accent hover:underline"
          >
            View on ArcScan →
          </a>
        </div>
        <div className="mt-6 border-t border-border-subtle pt-4">
          <MonoValue value={JOBS_ADDRESS} className="text-tertiary" truncate={0} />
        </div>
      </Card>

      <p className="mt-6 max-w-[62ch] text-[13px] leading-relaxed text-tertiary">
        Per-job lifecycle (created → funded → submitted → completed) reads directly from the Jobs
        contract during the demo — this page shows the pool-level count, not a per-row feed, to
        avoid rendering a field layout that wasn&rsquo;t independently confirmed against the real
        deployment. See <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">/docs/arc</code>.
      </p>
    </div>
  );
}
