import type { MandateNode } from "./useMandateGraph";
import type { Hex } from "viem";

export interface LayoutPosition {
  x: number;
  y: number;
}

const COLUMN_WIDTH = 220;
const ROW_HEIGHT = 140;

/**
 * A simple layered tree layout (BFS by depth, siblings spread evenly within their depth) — no
 * physics simulation needed for a mandate tree that's realistically a handful of nodes deep and
 * wide. Nodes with no resolvable parent (including the synthetic org root) sit at depth 0.
 */
export function layoutTree(nodes: MandateNode[]): Map<Hex, LayoutPosition> {
  const byParent = new Map<Hex | null, MandateNode[]>();
  for (const n of nodes) {
    const key = n.parentNode;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }

  const positions = new Map<Hex, LayoutPosition>();
  const roots = byParent.get(null) ?? [];

  function place(list: MandateNode[], depth: number, xOffset: number): number {
    let cursor = xOffset;
    for (const n of list) {
      const children = byParent.get(n.node) ?? [];
      if (children.length === 0) {
        positions.set(n.node, { x: cursor * COLUMN_WIDTH, y: depth * ROW_HEIGHT });
        cursor += 1;
      } else {
        const childCursorBefore = cursor;
        cursor = place(children, depth + 1, cursor);
        const center = (childCursorBefore + cursor - 1) / 2;
        positions.set(n.node, { x: center * COLUMN_WIDTH, y: depth * ROW_HEIGHT });
      }
    }
    return cursor;
  }

  place(roots, 0, 0);
  return positions;
}
