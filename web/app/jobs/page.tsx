"use client";

import { useReadContract } from "wagmi";
import { arcTestnet } from "viem/chains";
import type { Address } from "viem";
import { JobsAbi } from "../../lib/jobsAbi";
import { Card } from "@mandate/ui/components/Card";
import { MonoValue } from "@mandate/ui/components/MonoValue";

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
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-xl font-medium text-primary">Jobs</h1>
      <p className="mt-2 text-sm text-secondary">
        ERC-8183 job escrow on Arc — funded from the treasury, delivered, settled, reputation
        written by a distinct evaluator.
      </p>

      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-tertiary">Total jobs created</p>
            <p className="mt-1 font-mono text-2xl tabular-nums text-primary">
              {isLoading ? "…" : (jobCount?.toString() ?? "—")}
            </p>
          </div>
          <a
            href={`${EXPLORER}/${JOBS_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] text-accent hover:underline"
          >
            View on ArcScan →
          </a>
        </div>
        <div className="mt-4 border-t border-border-subtle pt-4">
          <MonoValue value={JOBS_ADDRESS} className="text-tertiary" truncate={0} />
        </div>
      </Card>

      <p className="mt-6 text-[13px] text-tertiary">
        Per-job lifecycle (created → funded → submitted → completed) reads directly from the Jobs
        contract during the demo — this page shows the pool-level count, not a per-row feed, to
        avoid rendering a field layout that wasn&rsquo;t independently confirmed against the real
        deployment. See <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">/docs/arc</code>.
      </p>
    </div>
  );
}
