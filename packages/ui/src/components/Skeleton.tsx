import { cn } from "../lib/cn";

/**
 * Loading placeholder. Every route in the observatory backfills chain logs on mount, which is
 * genuinely slow — showing the shape of the answer beats showing a spinner or, worse, an empty
 * state that looks like "no mandates exist".
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse-live rounded-md bg-surface-3", className)}
    />
  );
}

/** N skeleton rows sized like the table they stand in for. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
