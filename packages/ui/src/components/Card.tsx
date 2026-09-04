import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.js";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Raise one elevation tier — use sparingly, most panels sit flush against the base. */
  elevated?: boolean;
}

/** The base surface primitive — every panel, table, and stat tile builds on this. */
export function Card({ elevated = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border",
        elevated ? "bg-surface-2" : "bg-surface",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
