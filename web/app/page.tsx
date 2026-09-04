"use client";

import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAccount, useWriteContract } from "wagmi";
import { sepolia } from "viem/chains";
import type { Hex } from "viem";
import { MandateRegistrarAbi } from "@mandate/shared/abis";
import { getDeployedAddresses, isDeployed } from "../lib/addresses";
import { mandateStateOf, useMandateGraph } from "../lib/useMandateGraph";
import { layoutTree } from "../lib/treeLayout";
import { MandateNodeCard, type MandateNodeCardData } from "./_components/MandateNodeCard";
import { NotDeployed } from "./_components/NotDeployed";

const nodeTypes = { mandate: MandateNodeCard };

function GraphInner({ registrarAddress }: { registrarAddress: Hex }) {
  const { nodes: mandateNodes, loading } = useMandateGraph(registrarAddress);
  const { writeContract, isPending } = useWriteContract();
  const { isConnected } = useAccount();
  const [revokingNode, setRevokingNode] = useState<Hex | null>(null);
  const now = Math.floor(Date.now() / 1000);

  const positions = useMemo(() => layoutTree(mandateNodes), [mandateNodes]);

  const flowNodes: Node[] = useMemo(
    () =>
      mandateNodes.map((m) => {
        const pos = positions.get(m.node) ?? { x: 0, y: 0 };
        const data: MandateNodeCardData = {
          label: m.node.slice(0, 10) + "…",
          agentWallet: m.agentWallet,
          expiry: Number(m.expiry),
          state: mandateStateOf(m, now),
          revoking: revokingNode === m.node && isPending,
          onRevoke: () => {
            setRevokingNode(m.node);
            writeContract({
              address: registrarAddress,
              abi: MandateRegistrarAbi,
              functionName: "revokeMandate",
              args: [m.node, ("0x" + "0".repeat(64)) as Hex],
              chainId: sepolia.id,
            });
          },
        };
        return {
          id: m.node,
          type: "mandate",
          position: pos,
          data: data as unknown as Record<string, unknown>,
        };
      }),
    [mandateNodes, positions, now, revokingNode, isPending, registrarAddress, writeContract],
  );

  const flowEdges: Edge[] = useMemo(
    () =>
      mandateNodes
        .filter((m) => m.parentNode !== null)
        .map((m) => ({
          id: `${m.parentNode}-${m.node}`,
          source: m.parentNode as string,
          target: m.node,
          animated: !m.revoked,
          style: { stroke: m.revoked ? "var(--color-revoked)" : "var(--color-border-strong)" },
        })),
    [mandateNodes],
  );

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-tertiary">
        Reading mandate history from Sepolia…
      </div>
    );
  }

  if (mandateNodes.length === 0) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="max-w-sm rounded-xl border border-dashed border-border-strong bg-surface px-8 py-12 text-center">
          <p className="text-sm font-medium text-primary">No mandates issued yet</p>
          <p className="mt-2 text-[13px] text-tertiary">
            {isConnected ? "Issue the first one from " : "Sign in and issue the first one from "}
            <span className="font-mono text-secondary">/mandate/new</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} fitView proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--color-border-subtle)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export default function GraphPage() {
  const addresses = getDeployedAddresses();

  if (!isDeployed(addresses)) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center px-6">
        <NotDeployed what="MandateRegistrar" />
      </div>
    );
  }

  return <GraphInner registrarAddress={addresses.mandateRegistrar!} />;
}
