"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { fadeUp, stagger, VIEWPORT } from "@mandate/ui/lib/motion";

export interface FaqItem {
  question: string;
  answer: string;
}

/** One question. The answer's wrapper animates `grid-template-rows` between `0fr` and `1fr`
 *  rather than measuring pixel height — a CSS-only way to transition to "auto" height that never
 *  needs a resize observer or a hard-coded max-height guess. */
function FaqRow({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  return (
    <motion.div variants={fadeUp} className="py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <h3 className="font-sans text-[17px] font-semibold tracking-tight text-primary">
          {item.question}
        </h3>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          className={`shrink-0 text-tertiary transition-transform duration-200 ${open ? "rotate-45" : ""}`}
          aria-hidden
        >
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="pb-4 text-[14px] leading-relaxed text-secondary">{item.answer}</p>
        </div>
      </div>
    </motion.div>
  );
}

/** Closed by default, one open at a time — clicking a second question closes the first rather
 *  than stacking every answer open, since that's the whole point of collapsing them. */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <motion.div
      variants={stagger(0.06)}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      className="mt-10 divide-y divide-border-subtle border-t border-border-subtle"
    >
      {items.map((item, i) => (
        <FaqRow
          key={item.question}
          item={item}
          open={openIndex === i}
          onToggle={() => setOpenIndex((cur) => (cur === i ? null : i))}
        />
      ))}
    </motion.div>
  );
}
