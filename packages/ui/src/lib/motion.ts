/**
 * The motion system, as data.
 *
 * One easing curve governs the entire product. `EASE_OUT` is the JS twin of the `--ease-out`
 * custom property in tokens.css — the same cubic-bezier control points, so a CSS transition and a
 * Motion animation running side by side are indistinguishable. Nothing here bounces, overshoots,
 * or loops: this is a page about irrevocable financial authority, and springy UI undercuts it.
 *
 * Durations are deliberately few. Three values cover every case, and a component that "needs" a
 * fourth is usually animating something it shouldn't.
 */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DURATION = {
  /** State flips that must feel instant: hover, press, colour change. */
  fast: 0.18,
  /** The default. Reveals, drawer slides, layout shifts. */
  base: 0.42,
  /** Deliberate, attention-carrying moves — the hero's kill sequence. */
  slow: 0.68,
} as const;

/**
 * Section reveal. Applied to a container with `whileInView`, it staggers its children by a beat
 * short enough to read as one gesture rather than a queue. `once: true` everywhere — content that
 * re-animates on every scroll-by is a toy, not a product.
 */
export const VIEWPORT = { once: true, amount: 0.25 } as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE_OUT },
  },
} as const;

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
} as const;

/** Parent variant: children inherit `visible` and play in sequence. */
export const stagger = (delayChildren = 0, staggerChildren = 0.07) =>
  ({
    hidden: {},
    visible: { transition: { delayChildren, staggerChildren } },
  }) as const;
