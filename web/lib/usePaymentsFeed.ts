"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { arcTestnet } from "viem/chains";
import { AgentTreasuryAbi } from "@mandate/shared/abis";
import { getContractEventsChunked } from "@mandate/shared/eventLogs";
import type { Address, Hex } from "viem";

export interface PaymentRow {
  agent: Address;
  recipient: Address;
  amount: bigint;
  txHash: Hex;
  block: bigint;
}

/**
 * Every payment this org's agents have made, straight from `AgentTreasury.AgentSpent` — the same
 * event the contract emits on a successful `payTo`. Chunked backfill + a live watch, so a payment
 * made while the dashboard is open shows up without a reload. This is where the demo's agent
 * spends appear.
 */
export function usePaymentsFeed(treasury: Address | undefined, fromBlock: bigint | "earliest" = "earliest") {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const client = usePublicClient({ chainId: arcTestnet.id });

  useEffect(() => {
    if (!treasury || !client) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const logs = await getContractEventsChunked(client, {
        address: treasury,
        abi: AgentTreasuryAbi,
        eventName: "AgentSpent",
        fromBlock,
      });
      if (cancelled) return;
      setRows(
        logs
          .map((log) => ({
            agent: log.args.agent!,
            recipient: log.args.recipient!,
            amount: log.args.amount!,
            txHash: log.transactionHash,
            block: log.blockNumber,
          }))
          .sort((a, b) => (a.block < b.block ? 1 : -1)),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [treasury, client, fromBlock]);

  useWatchContractEvent({
    address: treasury,
    abi: AgentTreasuryAbi,
    eventName: "AgentSpent",
    chainId: arcTestnet.id,
    enabled: Boolean(treasury),
    onLogs(logs) {
      setRows((prev) => [
        ...logs.map((log) => ({
          agent: log.args.agent!,
          recipient: log.args.recipient!,
          amount: log.args.amount!,
          txHash: log.transactionHash!,
          block: log.blockNumber!,
        })),
        ...prev,
      ]);
    },
  });

  return { rows, loading };
}
