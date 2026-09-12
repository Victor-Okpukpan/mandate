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

const ROOT_PARENT = ("0x" + "0".repeat(64)) as Hex;
const EXPIRING_WINDOW_SECONDS = 24 * 60 * 60; // within 24h of expiry reads as "expiring"

/**
 * Authority graph, read by direct contract state — `mandateCount()` + `nodesPaginated()` +
 * `getMandate(node)` per node — not `MandateIssued`/`MandateAmended`/`MandateRevoked` logs. A
 * public, multi-tenant Sepolia RPC has been observed to silently and *persistently* drop a real,
 * existing historical log (not a transient flake — a full chunked sweep back to genesis still
 * missed it), which made an actually-issued mandate invisible here even though it read back fine
 * from the contract directly. `useWatchContractEvent` below still watches events live for a
 * same-session "appears without a reload" feel, and the 15s re-poll is what actually guarantees
 * correctness if that live subscription hits the same failure mode — see `useOrgs`'s matching fix
 * and NatSpec for the org-level version of this same problem.
 *
 * "Stale" (the Enforcer-liveness state, distinct from an expired mandate) isn't derivable from
 * Sepolia state alone — it needs each node's Arc-side `MandateAnchor.updatedAt`, read separately
 * per agent wallet. This hook reports live/expiring/revoked from Sepolia only; the page composes
 * the Arc-side staleness check on top.
 */
export function useMandateGraph(registrarAddress: Address | undefined, _fromBlock?: bigint) {
  const [nodes, setNodes] = useState<Map<Hex, MandateNode>>(new Map());
  const [loading, setLoading] = useState(true);
  const publicClient = usePublicClient({ chainId: sepolia.id });

  useEffect(() => {
    if (!registrarAddress || !publicClient) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      const count = await publicClient!.readContract({
        address: registrarAddress!,
        abi: MandateRegistrarAbi,
        functionName: "mandateCount",
      });
      if (count === 0n) {
        if (!cancelled) setLoading(false);
        return;
      }

      const nodeHashes = await publicClient!.readContract({
        address: registrarAddress!,
        abi: MandateRegistrarAbi,
        functionName: "nodesPaginated",
        args: [0n, count],
      });

      const mandates = await Promise.all(
        nodeHashes.map((node) =>
          publicClient!.readContract({
            address: registrarAddress!,
            abi: MandateRegistrarAbi,
            functionName: "getMandate",
            args: [node],
          }),
        ),
      );

      if (cancelled) return;

      setNodes((prev) => {
        // Bail out with the SAME reference when nothing actually changed — the poll below runs
        // every 15s regardless, and committing a fresh Map every tick would re-render every
        // consumer on that cadence forever. That churn is exactly what caused a `/org/[name]`
        // prefetch storm on the onboarding wizard: a failed Next.js prefetch isn't cached, so
        // re-rendering its parent every 15s kept re-attempting it until the tab ran out of
        // connections (`ERR_INSUFFICIENT_RESOURCES`). See `useOrgs`'s matching fix.
        let changed = prev.size !== mandates.length;
        const next = new Map(prev);
        for (const m of mandates) {
          const parentNode = m.parentNode === ROOT_PARENT ? null : m.parentNode;
          const existing = prev.get(m.node);
          if (
            !existing ||
            existing.agentWallet !== m.agentWallet ||
            existing.resolver !== m.resolver ||
            existing.expiry !== m.terms.expiry ||
            existing.revoked !== m.revoked ||
            existing.parentNode !== parentNode
          ) {
            changed = true;
            next.set(m.node, {
              node: m.node,
              parentNode,
              agentWallet: m.agentWallet,
              resolver: m.resolver,
              expiry: m.terms.expiry,
              revoked: m.revoked,
            });
          }
        }
        return changed ? next : prev;
      });
      setLoading(false);
    }

    load().catch(() => setLoading(false));
    // Same reasoning as `useOrgs`'s vault poll: a dropped or flaky RPC read must resolve on its
    // own shortly after, not require a manual page reload.
    const id = setInterval(() => load().catch(() => {}), 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
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
            parentNode: parentNode === ROOT_PARENT ? null : parentNode,
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
