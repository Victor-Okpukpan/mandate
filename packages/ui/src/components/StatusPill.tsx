import { cn } from "../lib/cn";

/**
 * The product's real vocabulary — four states, and nothing else in the system uses saturated
 * color. Every graph node, ledger row, and docs diagram reuses exactly these four, so a judge
 * learns the palette once (in the landing hero) and it means the same thing everywhere after.
 */
export type MandateState = "live" | "expiring" | "revoked" | "stale";

const STATE_LABEL: Record<MandateState, string> = {
  live: "Live",
  expiring: "Expiring",
  revoked: "Revoked",
  stale: "Stale",
};

const STATE_CLASSES: Record<MandateState, string> = {
  live: "bg-live-subtle text-live-strong border-live/30",
  expiring: "bg-expiring-subtle text-expiring-strong border-expiring/30",
  revoked: "bg-revoked-subtle text-revoked-strong border-revoked/30",
  stale: "bg-stale-subtle text-stale-strong border-stale/30",
};

const DOT_CLASSES: Record<MandateState, string> = {
  live: "bg-live",
  expiring: "bg-expiring",
  revoked: "bg-revoked",
  stale: "bg-stale",
};

export interface StatusPillProps {
  state: MandateState;
  /** Override the default label, e.g. to show a countdown instead of "Expiring". */
  label?: string;
  /** Pulses the dot — reserve for the single node currently mid-transaction, not every live node. */
  pulse?: boolean;
  className?: string;
}

export function StatusPill({ state, label, pulse = false, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums",
        STATE_CLASSES[state],
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[state], pulse && "animate-pulse-live")}
        aria-hidden
      />
      {label ?? STATE_LABEL[state]}
    </span>
  );
}
