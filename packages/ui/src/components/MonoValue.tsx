import { cn } from "../lib/cn";

export interface MonoValueProps {
  value: string;
  /** Characters kept at each end when truncating, e.g. 6 -> "0x1234…abcd". 0 disables truncation. */
  truncate?: number;
  className?: string;
}

/** Every address, hash, and node id renders through this — one place governing the mono face, the
 *  truncation rule, and the full value in `title` for anyone who hovers. */
export function MonoValue({ value, truncate = 6, className }: MonoValueProps) {
  const display =
    truncate > 0 && value.length > truncate * 2 + 1
      ? `${value.slice(0, truncate)}…${value.slice(-truncate)}`
      : value;

  return (
    <span title={value} className={cn("font-mono text-[13px] tnum", className)}>
      {display}
    </span>
  );
}
