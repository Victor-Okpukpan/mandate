"use client";

import { useMemo } from "react";
import type { Hex } from "viem";
import { StatusPill } from "@mandate/ui/components/StatusPill";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { Countdown } from "@mandate/ui/components/Countdown";
import { Table, TableWrap, Td, Th, Tr } from "@mandate/ui/components/Table";
import type { MandateNode } from "../../lib/useMandateGraph";
import { mandateStateOf } from "../../lib/useMandateGraph";

interface FlatRow {
  node: MandateNode;
  depth: number;
  isLast: boolean;
  ancestorIsLast: boolean[];
}

/**
 * Depth-first flatten of the parent→child adjacency the registrar's events already encode, in
 * issuance order at each level. `ancestorIsLast` records, for every ancestor level, whether that
 * ancestor was the last sibling at its own level — that's what lets a leaf draw a plain corner
 * (`└─`) under an ancestor that has more siblings below it, versus a straight rule (`│`) when it
 * doesn't. Same bookkeeping ASCII tree renderers and `tree(1)` use.
 */
function flattenTree(nodes: MandateNode[]): FlatRow[] {
  const byParent = new Map<Hex | null, MandateNode[]>();
  for (const n of nodes) {
    const key = n.parentNode;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }

  const rows: FlatRow[] = [];
  function walk(list: MandateNode[], depth: number, ancestorIsLast: boolean[]) {
    list.forEach((n, i) => {
      const isLast = i === list.length - 1;
      rows.push({ node: n, depth, isLast, ancestorIsLast });
      const children = byParent.get(n.node) ?? [];
      if (children.length > 0) walk(children, depth + 1, [...ancestorIsLast, isLast]);
    });
  }
  walk(byParent.get(null) ?? [], 0, []);
  return rows;
}

function TreeGuides({ depth, isLast, ancestorIsLast }: Omit<FlatRow, "node">) {
  if (depth === 0) return null;
  return (
    <span className="inline-flex shrink-0 font-mono text-border-strong" aria-hidden>
      {ancestorIsLast.slice(1).map((last, i) => (
        <span key={i} className="inline-block w-4">
          {last ? "" : "│"}
        </span>
      ))}
      <span className="inline-block w-4">{isLast ? "└" : "├"}</span>
    </span>
  );
}

export interface MandateTreeProps {
  nodes: MandateNode[];
  /** node -> human label ("research"), from `useMandateLabels`. No registrar event carries this —
   *  without it every row falls back to its raw node hash, which is what this table did before
   *  that hook existed. */
  labels?: Map<Hex, string>;
  selectedNode?: Hex;
  onSelect: (node: Hex) => void;
}

/**
 * The mandate hierarchy as an indented outline table — replaces the React Flow node canvas.
 * Indentation carries delegation depth the way a file tree carries directory nesting; a reader
 * scans budgets and expiries down a column instead of hunting for them inside boxes on a canvas.
 */
export function MandateTree({ nodes, labels, selectedNode, onSelect }: MandateTreeProps) {
  const now = Math.floor(Date.now() / 1000);
  const rows = useMemo(() => flattenTree(nodes), [nodes]);

  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th className="min-w-[16rem]">Name</Th>
            <Th>State</Th>
            <Th>Agent wallet</Th>
            <Th>Expires</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ node, depth, isLast, ancestorIsLast }) => {
            const state = mandateStateOf(node, now);
            const selected = node.node === selectedNode;
            return (
              <Tr
                key={node.node}
                interactive
                selected={selected}
                onClick={() => onSelect(node.node)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(node.node);
                }}
              >
                <Td>
                  <span className="flex items-center">
                    <TreeGuides depth={depth} isLast={isLast} ancestorIsLast={ancestorIsLast} />
                    {labels?.get(node.node) ? (
                      <span className="font-mono text-[13px] text-primary">{labels.get(node.node)}</span>
                    ) : (
                      <MonoValue value={node.node} truncate={6} className="text-primary" />
                    )}
                  </span>
                </Td>
                <Td>
                  <StatusPill state={state} bare />
                </Td>
                <Td>
                  <MonoValue value={node.agentWallet} className="text-secondary" />
                </Td>
                <Td>
                  <Countdown expiresAt={Number(node.expiry)} urgency={node.revoked ? "revoked" : undefined} />
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
