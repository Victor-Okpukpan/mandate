"use client";

import { useEffect, useState } from "react";
import { cn } from "../lib/cn";

export type CountdownUrgency = "live" | "expiring" | "revoked";

export interface CountdownProps {
  /** Unix seconds. Past values render as "expired" rather than a negative countdown. */
  expiresAt: number;
  /** Override the derived urgency colour — pass this when the caller already knows revocation
   *  status, since an expiry timestamp alone can't distinguish "expired" from "revoked" (both would
   *  otherwise read as the same "0s left" state). Omit it to let the countdown derive live/expiring
   *  purely from time remaining. */
  urgency?: CountdownUrgency;
  className?: string;
}

const URGENCY_CLASSES: Record<CountdownUrgency, string> = {
  live: "text-live",
  expiring: "text-expiring",
  revoked: "text-revoked",
};

const EXPIRING_WINDOW_SECONDS = 24 * 60 * 60; // matches useMandateGraph's own threshold

function deriveUrgency(secondsLeft: number): CountdownUrgency {
  if (secondsLeft <= 0) return "revoked";
  if (secondsLeft <= EXPIRING_WINDOW_SECONDS) return "expiring";
  return "live";
}

function format(secondsLeft: number): string {
  if (secondsLeft <= 0) return "expired";
  const d = Math.floor(secondsLeft / 86_400);
  const h = Math.floor((secondsLeft % 86_400) / 3_600);
  const m = Math.floor((secondsLeft % 3_600) / 60);
  const s = Math.floor(secondsLeft % 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** A live, ticking time-to-expiry — the graph edges' whole point is that these count down in real
 *  time. `tabular-nums` keeps the layout still as digits change, and colour carries urgency the
 *  same way the rest of the state system does, so a countdown never sits there as plain digits. */
export function Countdown({ expiresAt, urgency, className }: CountdownProps) {
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = expiresAt - now;
  const resolvedUrgency = urgency ?? deriveUrgency(secondsLeft);

  return (
    <span className={cn("font-mono tnum", URGENCY_CLASSES[resolvedUrgency], className)}>
      {format(secondsLeft)}
    </span>
  );
}
