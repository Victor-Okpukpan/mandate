import { cn } from "../lib/cn";

/**
 * The product's real vocabulary — four states, and besides the single accent nothing else in the
 * system uses saturated colour. Every table row, drawer header, and docs diagram reuses exactly
 * these four, so a reader learns the palette once (in the landing hero) and it means the same
 * thing everywhere after.
 */
export type MandateState = "live" | "expiring" | "revoked" | "stale";

const STATE_LABEL: Record<MandateState, string> = {
  live: "Live",
  expiring: "Expiring",
  revoked: "Revoked",
  stale: "Stale",
};

const STATE_CLASSES: Record<MandateState, string> = {
  live: "bg-live-subtle text-live-strong border-live/25",
  expiring: "bg-expiring-subtle text-expiring-strong border-expiring/25",
  revoked: "bg-revoked-subtle text-revoked-strong border-revoked/25",
  stale: "bg-stale-subtle text-stale-strong border-stale/25",
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
  /** Pulses the dot — reserve for the single row currently mid-transaction, not every live one. */
  pulse?: boolean;
  /** Drops the chip background and border, leaving dot + label. For dense table rows, where a
   *  column of filled pills turns into visual noise. */
  bare?: boolean;
  className?: string;
}

export function StatusPill({ state, label, pulse = false, bare = false, className }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium tnum",
        bare
          ? cn(
              "text-secondary",
              state === "revoked" && "text-revoked-strong",
              state === "stale" && "text-stale-strong",
            )
          : cn("rounded-full border px-2.5 py-1", STATE_CLASSES[state]),
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          DOT_CLASSES[state],
          pulse && "animate-pulse-live",
        )}
        aria-hidden
      />
      {label ?? STATE_LABEL[state]}
    </span>
  );
}
