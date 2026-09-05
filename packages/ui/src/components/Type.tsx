import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

const DISPLAY_SIZES = {
  sm: "text-display-sm",
  md: "text-display-md",
  lg: "text-display-lg",
  xl: "text-display-xl",
} as const;

export interface DisplayProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  size?: keyof typeof DISPLAY_SIZES;
  children: ReactNode;
}

/**
 * The one type voice, at display size. Weight 500 by default — DM Sans at display size reads thin
 * at 400, and a grotesk needs some weight to hold its own the way a serif's built-in contrast
 * does for free. Tight, negative tracking is what actually creates the "display" feel here, since
 * there's no second face to contrast against.
 */
export function Display({ as: Tag = "h2", size = "md", className, children, ...props }: DisplayProps) {
  return (
    <Tag
      className={cn(
        "font-sans font-medium text-primary tracking-display",
        "leading-[1.05] text-balance",
        DISPLAY_SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

/**
 * The mono voice at its smallest — section eyebrows, table column headers, field labels. Uppercase
 * and opened up, so it reads as a machine label rather than as shouted prose.
 */
export function Eyebrow({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] uppercase tracking-label text-tertiary",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}

/** Standfirst under a Display — one size up from body, one shade down from primary. */
export function Lede({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("max-w-[58ch] text-[17px] leading-[1.62] text-secondary text-pretty", className)}
      {...props}
    >
      {children}
    </p>
  );
}

/** A hairline rule carrying a mono label — the section divider used throughout both apps. */
export function RuleLabel({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-4", className)} {...props}>
      <span className="font-mono text-[11px] uppercase tracking-label text-tertiary">
        {children}
      </span>
      <span className="h-px flex-1 bg-border-subtle" aria-hidden />
    </div>
  );
}
