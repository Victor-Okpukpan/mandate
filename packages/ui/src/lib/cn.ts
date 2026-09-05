import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Plain `twMerge()` only knows Tailwind's default theme — it has no way to know `live`/`expiring`/
 * `revoked`/`stale`/`accent` are colour scales defined in our own `tokens.css`. Without this
 * extension, a class list like `"text-live text-[13px]"` gets misread as two conflicting text-size
 * utilities (both start with `text-`) and silently drops the state colour — confirmed happening to
 * `Countdown`'s urgency colour before this fix existed. Registering our custom names under
 * `theme.color` teaches twMerge to treat them as colours, not sizes.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "accent-subtle",
        "accent",
        "accent-strong",
        "accent-pressed",
        "live-subtle",
        "live",
        "live-strong",
        "expiring-subtle",
        "expiring",
        "expiring-strong",
        "revoked-subtle",
        "revoked",
        "revoked-strong",
        "stale-subtle",
        "stale",
        "stale-strong",
        "primary",
        "secondary",
        "tertiary",
        "disabled",
        "on-accent",
      ],
    },
  },
});

/**
 * Classname joiner with actual conflict resolution — a caller passing `className="p-8"` to
 * override a component's own `p-6` needs the later utility to win, not sit duplicated alongside
 * the first. A plain `.filter(Boolean).join(" ")` can't do that; `twMerge` resolves Tailwind's own
 * conflicts, `clsx` handles the falsy/conditional inputs first.
 */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}
