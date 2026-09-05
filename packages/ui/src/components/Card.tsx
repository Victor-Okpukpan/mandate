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
  /** Real elevation (a shadow), not a background swap — for anything meant to read as raised off
   *  the page rather than flush against it. On paper, use this sparingly: one raised thing per
   *  view, or nothing reads as raised. */
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
        "rounded-xl border border-border-subtle bg-surface",
        PADDING_CLASSES[padding],
        elevated ? "shadow-lg" : "shadow-xs",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A card's title/eyebrow row — flush against the top edge with a hairline below. */
export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mb-5 flex items-start justify-between gap-4 border-b border-border-subtle pb-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A card's action row — flush against the bottom edge with a hairline above. */
export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-5 flex items-center gap-3 border-t border-border-subtle pt-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}
