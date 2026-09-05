"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { EASE_OUT } from "../lib/motion";
import { cn } from "../lib/cn";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Rendered in the drawer's own header row, left of the close button. */
  title?: ReactNode;
  className?: string;
}

/**
 * The right-hand detail panel — clicking a mandate row opens this instead of navigating away, so
 * the tree behind it stays in view and selected. Slides from the actual edge of the viewport
 * (not just fades) so its origin is legible, and closes on Escape or scrim click.
 */
export function Drawer({ open, onClose, children, title, className }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto",
              "border-l border-border bg-surface shadow-xl",
              className,
            )}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.38, ease: EASE_OUT }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-6 py-5">
              <div className="min-w-0">{title}</div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-tertiary transition-colors hover:bg-surface-2 hover:text-primary"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    d="M6 6l12 12M18 6 6 18"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 px-6 py-6">{children}</div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
