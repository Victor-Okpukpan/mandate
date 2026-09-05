import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface StatProps {
  label: string;
  value: ReactNode;
  /** Small trailing unit set in mono at label size — "USDC", "%", "agents". Kept separate from
   *  `value` so the figure stays the only thing at display size. */
  unit?: string;
  hint?: ReactNode;
  className?: string;
}

/**
 * A single figure, set at display size and weight. This is where the "no charts" constraint pays
 * off: with nothing plotted, the number itself has to carry the weight, so it gets real
 * typographic treatment rather than being a 14px bold span in a box.
 */
export function Stat({ label, value, unit, hint, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="font-mono text-[11px] uppercase tracking-label text-tertiary">{label}</p>
      <p className="flex items-baseline gap-1.5">
        <span className="font-sans text-display-sm font-medium leading-none tracking-display text-primary tnum">
          {value}
        </span>
        {unit ? (
          <span className="font-mono text-[12px] text-tertiary">{unit}</span>
        ) : null}
      </p>
      {hint ? <p className="text-[13px] leading-snug text-tertiary">{hint}</p> : null}
    </div>
  );
}

export interface MeterProps {
  /** 0–1. Clamped, so a budget overshoot renders as full rather than overflowing its track. */
  value: number;
  /** Drives the fill colour through the same four-state vocabulary as everything else. */
  state?: "live" | "expiring" | "revoked" | "stale";
  className?: string;
  "aria-label"?: string;
}

const METER_FILL = {
  live: "bg-live",
  expiring: "bg-expiring",
  revoked: "bg-revoked",
  stale: "bg-stale",
} as const;

/**
 * A 3px consumption rule — deliberately not a chart. It answers exactly one question ("how much of
 * this budget is gone") at a glance, in a table cell, without axes, gridlines, or a legend.
 */
export function Meter({ value, state = "live", className, ...props }: MeterProps) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * 100;
  return (
    <div
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-[3px] w-full overflow-hidden rounded-full bg-surface-3", className)}
      {...props}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]",
          METER_FILL[state],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
