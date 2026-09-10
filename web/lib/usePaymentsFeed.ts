"use client";

import { useEffect, useRef, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { arcTestnet } from "viem/chains";
import { AgentTreasuryAbi } from "@mandate/shared/abis";
import type { Address, Hex } from "viem";

export interface PaymentRow {
  agent: Address;
  recipient: Address;
  amount: bigint;
  txHash: Hex;
  block: bigint;
}

/**
 * Every payment this org's agents make, from `AgentTreasury.AgentSpent`. Live-only, no historical
 * backfill: Arc's public RPC rejects `eth_getLogs` over any useful range, so this watches from the
 * current head forward and seeds itself with a short recent-window read on mount. For a live demo
 * (dashboard open while the agent spends) that's all that's needed; a reload loses prior rows.
 */
export function usePaymentsFeed(treasury: Address | undefined) {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const client = usePublicClient({ chainId: arcTestnet.id });
  const seen = useRef(new Set<string>());

  function add(list: PaymentRow[], where: "head" | "tail") {
    const fresh = list.filter((r) => {
      const k = `${r.txHash}:${r.recipient}:${r.amount}`;
      if (seen.current.has(k)) return false;
      seen.current.add(k);
      return true;
    });
    if (fresh.length === 0) return;
    setRows((prev) => (where === "head" ? [...fresh, ...prev] : [...prev, ...fresh]));
  }

  useEffect(() => {
    if (!treasury || !client) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const head = await client.getBlockNumber();
        const from = head > 2_000n ? head - 2_000n : 0n;
        const logs = await client.getContractEvents({
          address: treasury,
          abi: AgentTreasuryAbi,
          eventName: "AgentSpent",
          fromBlock: from,
          toBlock: head,
        });
        if (cancelled) return;
        add(
          logs
            .map((l) => ({
              agent: l.args.agent!,
              recipient: l.args.recipient!,
              amount: l.args.amount!,
              txHash: l.transactionHash,
              block: l.blockNumber,
            }))
            .sort((a, b) => (a.block < b.block ? 1 : -1)),
          "tail",
        );
      } catch (e) {
        console.warn("[usePaymentsFeed] recent-window read failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [treasury, client]);

  useWatchContractEvent({
    address: treasury,
    abi: AgentTreasuryAbi,
    eventName: "AgentSpent",
    chainId: arcTestnet.id,
    enabled: Boolean(treasury),
    onLogs(logs) {
      add(
        logs.map((l) => ({
          agent: l.args.agent!,
          recipient: l.args.recipient!,
          amount: l.args.amount!,
          txHash: l.transactionHash!,
          block: l.blockNumber!,
        })),
        "head",
      );
    },
  });

  return { rows, loading };
}
