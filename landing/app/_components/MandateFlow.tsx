import type { ReactNode } from "react";
import { motion } from "motion/react";
import { fadeUp, stagger, VIEWPORT } from "@mandate/ui/lib/motion";

export interface MandateFlowStep {
  title: string;
  description: ReactNode;
}

/**
 * A vertical, connected sequence rather than a grid of equal-weight boxes — the whole point of
 * this section is that these five things happen *in order*, each depending on the last, and a
 * card grid reads as five independent facts instead. One rail down the left, one node per step,
 * content beside it; nothing here is a `Card`.
 */
export function MandateFlow({ steps }: { steps: MandateFlowStep[] }) {
  return (
    <motion.div
      variants={stagger(0.1)}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      className="relative mt-12 max-w-2xl"
    >
      <div className="absolute left-3.75 top-2 bottom-2 w-px bg-border" aria-hidden />
      <div className="flex flex-col">
        {steps.map((step, i) => (
          <motion.div key={step.title} variants={fadeUp} className="relative flex gap-5 pb-10 last:pb-0">
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-base font-mono text-[12px] font-medium tnum text-accent">
              {i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <h3 className="font-sans text-[19px] font-semibold tracking-tight text-primary">{step.title}</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-secondary">{step.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
