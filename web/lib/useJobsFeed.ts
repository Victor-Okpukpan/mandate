"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useReadContract, useReadContracts, useWatchContractEvent } from "wagmi";
import { arcTestnet } from "viem/chains";
import { AgentTreasuryAbi, JobsAbi } from "@mandate/shared/abis";
import { getContractEventsChunked } from "@mandate/shared/eventLogs";
import type { Address } from "viem";

export interface JobRow {
  jobId: bigint;
  agent: Address;
  provider: Address;
  evaluator: Address;
  description: string;
  budget: bigint;
  expiredAt: bigint;
  status: number; // JobStatus: Open=0, Funded=1, Submitted=2, Completed=3, Rejected=4, Expired=5
}

export const JOB_STATUS_LABEL = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"] as const;

/**
 * This org's own job feed, scoped through `AgentTreasury.JobCreated` — not the shared Jobs
 * contract's own `jobCounter`, which spans every org and every direct integration on Arc. Every
 * job this reads was created via `treasury.createJob`, so it's guaranteed to belong to this org's
 * agents (see `AgentTreasury.sol`'s NatSpec on why the treasury, not the agent, must be the real
 * contract's `job.client`). Real per-job state (`status`, `budget`, ...) comes from `getJob` on
 * the real deployed Jobs contract itself, polled — the shared contract doesn't get a dedicated
 * per-org event subscription here, since its own status-changing events aren't addressable by org.
 */
export function useJobsFeed(treasury: Address | undefined, fromBlock: bigint | "earliest" = "earliest") {
  const [jobIds, setJobIds] = useState<{ jobId: bigint; agent: Address }[]>([]);
  const [loading, setLoading] = useState(true);
  const publicClient = usePublicClient({ chainId: arcTestnet.id });

  const { data: jobsAddress } = useReadContract({
    address: treasury,
    abi: AgentTreasuryAbi,
    functionName: "JOBS",
    chainId: arcTestnet.id,
    query: { enabled: Boolean(treasury) },
  });

  useEffect(() => {
    if (!treasury || !publicClient) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function backfill() {
      setLoading(true);
      const logs = await getContractEventsChunked(publicClient!, {
        address: treasury!,
        abi: AgentTreasuryAbi,
        eventName: "JobCreated",
        fromBlock,
      });
      if (cancelled) return;
      setJobIds(
        logs.map((log) => ({
          jobId: (log.args as { jobId: bigint }).jobId,
          agent: (log.args as { agent: Address }).agent,
        })),
      );
      setLoading(false);
    }
    backfill().catch((e) => console.warn("[useJobsFeed] backfill failed", e));
    return () => {
      cancelled = true;
    };
  }, [treasury, publicClient, fromBlock]);

  useWatchContractEvent({
    address: treasury,
    abi: AgentTreasuryAbi,
    eventName: "JobCreated",
    chainId: arcTestnet.id,
    enabled: Boolean(treasury),
    onLogs: (logs) => {
      setJobIds((prev) => [
        ...prev,
        ...logs.map((log) => ({
          jobId: (log.args as { jobId: bigint }).jobId,
          agent: (log.args as { agent: Address }).agent,
        })),
      ]);
    },
  });

  const { data: jobResults, isLoading: jobsLoading } = useReadContracts({
    contracts: jobIds.map(({ jobId }) => ({
      address: jobsAddress as Address | undefined,
      abi: JobsAbi,
      functionName: "getJob" as const,
      args: [jobId] as const,
      chainId: arcTestnet.id,
    })),
    query: { enabled: Boolean(jobsAddress) && jobIds.length > 0, refetchInterval: 10_000 },
  });

  const rows: JobRow[] = jobIds.map(({ jobId, agent }, i) => {
    const job = jobResults?.[i]?.result as
      | {
          id: bigint;
          client: Address;
          provider: Address;
          evaluator: Address;
          description: string;
          budget: bigint;
          expiredAt: bigint;
          status: number;
          hook: Address;
        }
      | undefined;
    return {
      jobId,
      agent,
      provider: job?.provider ?? ("0x0000000000000000000000000000000000000000" as Address),
      evaluator: job?.evaluator ?? ("0x0000000000000000000000000000000000000000" as Address),
      description: job?.description ?? "",
      budget: job?.budget ?? 0n,
      expiredAt: job?.expiredAt ?? 0n,
      status: job?.status ?? 0,
    };
  });

  return { rows: rows.sort((a, b) => Number(b.jobId - a.jobId)), loading: loading || jobsLoading };
}
