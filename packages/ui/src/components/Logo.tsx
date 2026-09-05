import { cn } from "../lib/cn";

/**
 * The one mark, everywhere — nav, sidebar, footer, favicon all derive from this same glyph, not
 * four independent hand-drawn dots. A minimal M in a rounded tile: two verticals with a shallow
 * notch between them, the same restrained-tile treatment product marks like Safe's own icon use.
 * Replaces the earlier pulsing-dot-plus-wordmark — that dot read as a generic "live" status
 * indicator, not a mark anyone would recognize on its own.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <rect x="0.75" y="0.75" width="18.5" height="18.5" rx="5" fill="var(--accent-subtle)" stroke="var(--accent)" strokeWidth="1.3" />
      <path
        d="M6 14.5V6.2l4 4.1 4-4.1v8.3"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-5 w-5 shrink-0" />
      <span className="font-mono text-[14px] font-medium tracking-tight text-primary">MANDATE</span>
    </span>
  );
}
