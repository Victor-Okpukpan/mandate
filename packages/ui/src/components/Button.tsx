import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

/**
 * On a near-monochrome page the primary button is often the only saturated element in view, so it
 * doesn't need a gradient, a glow, or a border of its own colour to be found. Secondary is a
 * hairline on paper. Danger stays outlined until hovered — revocation is irreversible, and a
 * permanently-red button invites the click.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-on-accent border border-transparent shadow-xs hover:bg-accent-strong active:bg-accent-pressed",
  secondary:
    "bg-surface text-primary border border-border shadow-xs hover:border-border-strong hover:bg-surface-2",
  ghost:
    "bg-transparent text-secondary border border-transparent hover:bg-surface-2 hover:text-primary",
  danger:
    "bg-transparent text-revoked border border-revoked/35 hover:bg-revoked-subtle hover:border-revoked/70",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-10 px-4 text-[14px] gap-2 rounded-lg",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap font-medium tracking-tight",
        "transition-[background-color,border-color,color,transform] duration-150 ease-[var(--ease-out)]",
        "active:translate-y-px disabled:pointer-events-none disabled:opacity-40",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
