"use client";

import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { sepolia } from "viem/chains";
import { MandateRegistrarAbi } from "@mandate/shared/abis";
import type { Address, Hex } from "viem";

export type MandateState = "live" | "expiring" | "revoked" | "stale";

export interface MandateNode {
  node: Hex;
  parentNode: Hex | null;
  agentWallet: Address;
  resolver: Address;
  expiry: bigint;
  revoked: boolean;
  label?: string;
}

const ZERO_NODE = "0x0000000000000000000000000000000000000000000000000000000000000000000000000000" as Hex;
const ROOT_PARENT = ("0x" + "0".repeat(64)) as Hex;
const EXPIRING_WINDOW_SECONDS = 24 * 60 * 60; // within 24h of expiry reads as "expiring"

/**
 * Event-sourced authority graph — no indexer, per the stack's own philosophy. Backfills every
 * MandateIssued/MandateAmended/MandateRevoked log on mount via `getContractEvents`, then
 * subscribes with `useWatchContractEvent` for everything after. State is derived from what the
 * registrar itself has emitted, nothing cached server-side.
 *
 * "Stale" (the Enforcer-liveness state, distinct from an expired mandate) isn't derivable from
 * these events alone — it needs each node's Arc-side `MandateAnchor.updatedAt`, read separately
 * per agent wallet. This hook reports live/expiring/revoked from Sepolia only; the page composes
 * the Arc-side staleness check on top.
 */
export function useMandateGraph(registrarAddress: Address | undefined) {
  const [nodes, setNodes] = useState<Map<Hex, MandateNode>>(new Map());
  const [loading, setLoading] = useState(true);
  const publicClient = usePublicClient({ chainId: sepolia.id });

  useEffect(() => {
    if (!registrarAddress || !publicClient) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function backfill() {
      setLoading(true);
      const issuedLogs = await publicClient!.getContractEvents({
        address: registrarAddress,
        abi: MandateRegistrarAbi,
        eventName: "MandateIssued",
        fromBlock: "earliest",
        toBlock: "latest",
      });
      const revokedLogs = await publicClient!.getContractEvents({
        address: registrarAddress,
        abi: MandateRegistrarAbi,
        eventName: "MandateRevoked",
        fromBlock: "earliest",
        toBlock: "latest",
      });

      if (cancelled) return;

      setNodes((prev) => {
        const next = new Map(prev);
        for (const log of issuedLogs) {
          const { node, parentNode, agentWallet, resolver, expiry } = log.args as {
            node: Hex;
            parentNode: Hex;
            agentWallet: Address;
            resolver: Address;
            expiry: bigint;
          };
          next.set(node, {
            node,
            parentNode: parentNode === ROOT_PARENT || parentNode === ZERO_NODE ? null : parentNode,
            agentWallet,
            resolver,
            expiry,
            revoked: false,
          });
        }
        for (const log of revokedLogs) {
          const { node } = log.args as { node: Hex };
          const existing = next.get(node);
          if (existing) next.set(node, { ...existing, revoked: true });
        }
        return next;
      });
      setLoading(false);
    }

    backfill().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [registrarAddress, publicClient]);

  useWatchContractEvent({
    address: registrarAddress,
    abi: MandateRegistrarAbi,
    eventName: "MandateIssued",
    chainId: sepolia.id,
    enabled: Boolean(registrarAddress),
    onLogs(logs) {
      setNodes((prev) => {
        const next = new Map(prev);
        for (const log of logs) {
          const { node, parentNode, agentWallet, resolver, expiry } = log.args as {
            node: Hex;
            parentNode: Hex;
            agentWallet: Address;
            resolver: Address;
            expiry: bigint;
          };
          next.set(node, {
            node,
            parentNode: parentNode === ROOT_PARENT || parentNode === ZERO_NODE ? null : parentNode,
            agentWallet,
            resolver,
            expiry,
            revoked: false,
          });
        }
        return next;
      });
    },
  });

  useWatchContractEvent({
    address: registrarAddress,
    abi: MandateRegistrarAbi,
    eventName: "MandateRevoked",
    chainId: sepolia.id,
    enabled: Boolean(registrarAddress),
    onLogs(logs) {
      setNodes((prev) => {
        const next = new Map(prev);
        for (const log of logs) {
          const { node } = log.args as { node: Hex };
          const existing = next.get(node);
          if (existing) next.set(node, { ...existing, revoked: true });
        }
        return next;
      });
    },
  });

  useWatchContractEvent({
    address: registrarAddress,
    abi: MandateRegistrarAbi,
    eventName: "MandateAmended",
    chainId: sepolia.id,
    enabled: Boolean(registrarAddress),
    onLogs(logs) {
      setNodes((prev) => {
        const next = new Map(prev);
        for (const log of logs) {
          const { node, expiry } = log.args as { node: Hex; expiry: bigint };
          const existing = next.get(node);
          if (existing) next.set(node, { ...existing, expiry });
        }
        return next;
      });
    },
  });

  return { nodes: Array.from(nodes.values()), loading };
}

export function mandateStateOf(node: MandateNode, nowSeconds: number): MandateState {
  if (node.revoked) return "revoked";
  const secondsLeft = Number(node.expiry) - nowSeconds;
  if (secondsLeft <= 0) return "revoked"; // expired reads the same as revoked to a counterparty
  if (secondsLeft <= EXPIRING_WINDOW_SECONDS) return "expiring";
  return "live";
}
