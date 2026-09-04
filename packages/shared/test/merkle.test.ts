import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { keccak256, encodePacked } from "viem";
import { buildAllowlist, leafForRecipient } from "../src/merkle.js";

const A: Address = "0x1111111111111111111111111111111111111111";
const B: Address = "0x2222222222222222222222222222222222222222";
const C: Address = "0x3333333333333333333333333333333333333333";
const STRANGER: Address = "0x9999999999999999999999999999999999999999";

function verify(root: `0x${string}`, leaf: `0x${string}`, proof: `0x${string}`[]): boolean {
  let computed = leaf;
  for (const sibling of proof) {
    const [lo, hi] = computed.toLowerCase() < sibling.toLowerCase() ? [computed, sibling] : [sibling, computed];
    computed = keccak256(encodePacked(["bytes32", "bytes32"], [lo, hi]));
  }
  return computed.toLowerCase() === root.toLowerCase();
}

describe("merkle allowlist (recipient-keyed leaves)", () => {
  it("produces a proof that verifies for every member, odd or even tree size", () => {
    for (const recipients of [[A], [A, B], [A, B, C]]) {
      const tree = buildAllowlist(recipients);
      for (const r of recipients) {
        expect(verify(tree.root, leafForRecipient(r), tree.proofFor(r))).toBe(true);
      }
    }
  });

  it("refuses to produce a proof for a non-member", () => {
    const tree = buildAllowlist([A, B, C]);
    expect(() => tree.proofFor(STRANGER)).toThrow();
  });

  it("a proof for one allowlist does not verify against another's root", () => {
    const treeA = buildAllowlist([A, B]);
    const treeB = buildAllowlist([A, C]);
    expect(verify(treeB.root, leafForRecipient(A), treeA.proofFor(A))).toBe(false);
  });
});
