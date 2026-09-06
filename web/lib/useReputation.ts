"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { arcTestnet } from "viem/chains";
import { ReputationRegistryAbi } from "@mandate/shared/abis";
import { getPublicArcAddresses } from "./publicNetworkAddresses";

export interface ReputationSummary {
  status: "unset" | "loading" | "no-feedback" | "available";
  count: number;
  averageValue: number;
}

/**
 * Read-only reputation summary for a mandate's bound erc8004 agent id, from the real Arc
 * ReputationRegistry (`getClients` → `getSummary`). Deliberately read-only: `giveFeedback` is
 * called by whoever HIRED the agent for a job, not by this dashboard, which is the agent's OWN
 * admin view — the natural place to submit feedback is wherever a job's counterparty already
 * operates, not here. `getSummary` reverts on an empty client list rather than returning zero, so
 * this checks `getClients` first and treats "no clients yet" as its own state, not an error.
 */
export function useReputation(erc8004IdText: string | undefined): ReputationSummary {
  const reputationRegistry = getPublicArcAddresses().erc8004Reputation;
  const agentId = erc8004IdText && /^\d+$/.test(erc8004IdText) ? BigInt(erc8004IdText) : undefined;

  const { data: clients, isLoading: clientsLoading } = useReadContract({
    address: reputationRegistry,
    abi: ReputationRegistryAbi,
    functionName: "getClients",
    args: agentId !== undefined ? [agentId] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: agentId !== undefined },
  });

  const { data: summaryResults, isLoading: summaryLoading } = useReadContracts({
    contracts: [
      {
        address: reputationRegistry,
        abi: ReputationRegistryAbi,
        functionName: "getSummary" as const,
        args: agentId !== undefined && clients ? ([agentId, clients, "", ""] as const) : undefined,
        chainId: arcTestnet.id,
      },
    ],
    query: { enabled: agentId !== undefined && Boolean(clients?.length) },
  });

  if (agentId === undefined) return { status: "unset", count: 0, averageValue: 0 };
  if (clientsLoading) return { status: "loading", count: 0, averageValue: 0 };
  if (!clients || clients.length === 0) return { status: "no-feedback", count: 0, averageValue: 0 };
  if (summaryLoading) return { status: "loading", count: 0, averageValue: 0 };

  const summary = summaryResults?.[0]?.result as readonly [bigint, bigint, number] | undefined;
  if (!summary || summary[0] === 0n) return { status: "no-feedback", count: 0, averageValue: 0 };

  const [count, summaryValue, summaryValueDecimals] = summary;
  const averageValue = Number(summaryValue) / 10 ** summaryValueDecimals;
  return { status: "available", count: Number(count), averageValue };
}
