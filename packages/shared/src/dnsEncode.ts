/**
 * ENS DNS wire-format encoding, used once per deployment to hand a registrar contract its own
 * root name in the format `PermissionedResolver.authorize*Roles()` expects. Every name below the
 * root is built entirely on-chain by prepending a length-prefixed label to the parent's already
 * DNS-encoded name (see `contracts/src/libraries/LibDNSEncode.sol`) — this file is not on any
 * hot path, only deploy scripts and the frontend's own display/lookup calls.
 */
import { normalize } from "viem/ens";
import { type Hex, toHex } from "viem";

/**
 * Encode a dot-separated ENS name ("research.acme.eth") into ENS/DNS wire format: each label
 * prefixed by its length byte, terminated by a zero byte. Matches `NameCoder.encode` semantics.
 * Labels are normalized (ENSIP-15 / UTS-46) before encoding.
 */
export function dnsEncodeName(name: string): Hex {
  const normalized = name === "" ? "" : normalize(name);
  const labels = normalized === "" ? [] : normalized.split(".");

  const bytes: number[] = [];
  for (const label of labels) {
    const labelBytes = new TextEncoder().encode(label);
    if (labelBytes.length === 0 || labelBytes.length > 255) {
      throw new Error(`dnsEncodeName: label "${label}" must be 1-255 bytes, got ${labelBytes.length}`);
    }
    bytes.push(labelBytes.length, ...labelBytes);
  }
  bytes.push(0); // root terminator

  return toHex(new Uint8Array(bytes));
}

/** Normalize a single ENS label (ENSIP-15 / UTS-46) — the same normalization dnsEncodeName applies per-label. */
export function normalizeLabel(label: string): string {
  return normalize(label);
}
