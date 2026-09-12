// Vendored from packages/shared/src/merkle.ts — duplicated, not imported, so this published
// package needs nothing from this monorepo. Keep in sync by hand if the source changes.
/**
 * Merkle allowlist over payment recipients. Leaves are keccak256(address), a design decision
 * documented in `contracts/src/AgentTreasury.sol`: the leaf binds the RECIPIENT, not a
 * (target, selector) pair, so no agent-supplied calldata ever executes from the pooled treasury —
 * see the plan's "typed spend paths" decision. Sorted-pair hashing matches OpenZeppelin's
 * `MerkleProof.verify`, which is what `AgentTreasury` and `MandateAnchor` check against on-chain.
 *
 * A child inherits its parent's `allowlistRoot` verbatim rather than proving a subset (mandate.md
 * §4.1's design decision) — so this module's only job is building trees for issuance and proofs
 * for spends, never diffing or narrowing one root into another.
 */
import { type Address, type Hex, encodePacked, keccak256 } from "viem";

function hashPair(a: Hex, b: Hex): Hex {
  const [lo, hi] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  return keccak256(encodePacked(["bytes32", "bytes32"], [lo, hi]));
}

export function leafForRecipient(recipient: Address): Hex {
  return keccak256(encodePacked(["address"], [recipient]));
}

export interface MerkleAllowlist {
  root: Hex;
  /** Proof for a given recipient; throws if the recipient isn't in the allowlist. */
  proofFor(recipient: Address): Hex[];
  readonly recipients: readonly Address[];
}

/** Build a sorted-pair merkle tree over an allowlist of recipient addresses. */
export function buildAllowlist(recipients: readonly Address[]): MerkleAllowlist {
  if (recipients.length === 0) {
    throw new Error("buildAllowlist: allowlist must contain at least one recipient");
  }

  const leaves = recipients.map(leafForRecipient);
  const layers: Hex[][] = [leaves];

  let current = leaves;
  while (current.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1];
      if (left === undefined) throw new Error("buildAllowlist: unreachable — empty layer slot");
      next.push(right === undefined ? left : hashPair(left, right));
    }
    layers.push(next);
    current = next;
  }

  const root = current[0];
  if (root === undefined) throw new Error("buildAllowlist: unreachable — empty root layer");

  const firstLayer = layers[0];
  if (firstLayer === undefined) throw new Error("buildAllowlist: unreachable — no leaf layer");

  return {
    root,
    recipients,
    proofFor(recipient: Address): Hex[] {
      const leaf = leafForRecipient(recipient);
      let index = firstLayer.indexOf(leaf);
      if (index === -1) {
        throw new Error(`proofFor: ${recipient} is not in this allowlist`);
      }
      const proof: Hex[] = [];
      for (let level = 0; level < layers.length - 1; level++) {
        const layer = layers[level];
        if (layer === undefined) throw new Error("proofFor: unreachable — missing layer");
        const isRightNode = index % 2 === 1;
        const pairIndex = isRightNode ? index - 1 : index + 1;
        const sibling = layer[pairIndex];
        if (pairIndex < layer.length && sibling !== undefined) {
          proof.push(sibling);
        }
        index = Math.floor(index / 2);
      }
      return proof;
    },
  };
}
