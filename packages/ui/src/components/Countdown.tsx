"use client";

import { useEffect, useState } from "react";
import { cn } from "../lib/cn";

export interface CountdownProps {
  /** Unix seconds. Past values render as "expired" rather than a negative countdown. */
  expiresAt: number;
  className?: string;
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

/** A live, ticking time-to-expiry — the graph edges' whole point is that these count down in
 *  real time. `tabular-nums` keeps the layout still as digits change. */
export function Countdown({ expiresAt, className }: CountdownProps) {
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = expiresAt - now;

  return <span className={cn("font-mono tabular-nums", className)}>{format(secondsLeft)}</span>;
}
