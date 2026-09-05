import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

const PADDING_CLASSES = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Real elevation (a shadow), not a background swap — use for anything meant to read as raised
   *  off the page rather than flush against it. */
  elevated?: boolean;
  padding?: keyof typeof PADDING_CLASSES;
}

/** The base surface primitive — every panel, table, and stat tile builds on this. */
export function Card({
  elevated = false,
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface",
        PADDING_CLASSES[padding],
        elevated && "shadow-lg",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A card's title/eyebrow row — sits flush against the top edge with a divider below. */
export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mb-4 flex items-start justify-between gap-4 border-b border-border-subtle pb-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A card's action row — sits flush against the bottom edge with a divider above. */
export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center gap-3 border-t border-border-subtle pt-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
