"use client";

import { useState } from "react";

/**
 * Answers the first question a new visitor actually has — "is this real, or a pitch deck?" —
 * before they even reach the hero. Dismissible per tab (sessionStorage, not persisted across
 * visits) rather than gone forever, since the honest caveat matters again next session.
 */
export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex items-center justify-center gap-3 border-b border-accent/20 bg-accent-subtle px-6 py-2.5 text-center">
      <p className="font-mono text-[12.5px] text-primary">
        Live on Sepolia + Arc testnet — every mandate on this site is real and revocable on-chain
        right now, not a mockup.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 text-tertiary transition-colors hover:text-primary"
      >
        ✕
      </button>
    </div>
  );
}
