"use client";

import { useState } from "react";
import { cn } from "../lib/cn";

export interface MonoValueProps {
  /** A nullish value renders as an em-dash rather than throwing — callers pass data that may not
   *  have loaded yet (an address still being read from chain, an optional record). */
  value: string | null | undefined;
  /** Characters kept at each end when truncating, e.g. 6 -> "0x1234…abcd". 0 disables truncation. */
  truncate?: number;
  className?: string;
  /** Adds a click-to-copy button next to the value. Off by default — a dense table of a dozen
   *  addresses doesn't need a button on every row, but a single wallet address someone actually
   *  needs to paste elsewhere (into a signer, an SDK call) does. */
  copyable?: boolean;
}

/** Every address, hash, and node id renders through this — one place governing the mono face, the
 *  truncation rule, and the full value in `title` for anyone who hovers. */
export function MonoValue({ value, truncate = 6, className, copyable = false }: MonoValueProps) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className={cn("font-mono text-[13px] tnum text-tertiary", className)}>—</span>;
  }
  const display =
    truncate > 0 && value.length > truncate * 2 + 1
      ? `${value.slice(0, truncate)}…${value.slice(-truncate)}`
      : value;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (permissions, insecure context) — the full value is still
      // visible via the `title` hover, so this fails quietly rather than surfacing an error.
    }
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span title={value} className={cn("font-mono text-[13px] tnum", className)}>
        {display}
      </span>
      {copyable ? (
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? "Copied" : `Copy ${value}`}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          className="shrink-0 rounded p-0.5 text-tertiary transition-colors hover:bg-surface-2 hover:text-primary"
        >
          {copied ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M2.5 6.5L4.5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
              <path d="M2.5 8V2.5C2.5 1.94772 2.94772 1.5 3.5 1.5H8" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </button>
      ) : null}
    </span>
  );
}
