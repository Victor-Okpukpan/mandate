import type { ReactNode } from "react";
import { motion } from "motion/react";
import { fadeUp, stagger, VIEWPORT } from "@mandate/ui/lib/motion";

export interface PlaneFlowNode {
  chain: string;
  title: string;
  accentClass: string;
  description: ReactNode;
}

/**
 * Three planes as one connected diagram, not three interchangeable cards — a single rule runs
 * behind every node so the eye reads it as one system with three stations, the same relationship
 * "one source of truth" is claiming in the copy above it. Vertical on mobile, horizontal from
 * `sm:` up; the connecting line rotates with it rather than just stacking the same boxes narrower.
 */
export function PlaneFlow({ nodes }: { nodes: PlaneFlowNode[] }) {
  return (
    <motion.div
      variants={stagger(0.12)}
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      className="relative mt-12"
    >
      {/* the spine: a vertical rule on mobile, horizontal from sm: up */}
      <div
        className="absolute left-3.75 top-2 bottom-2 w-px bg-border sm:left-0 sm:right-0 sm:top-3.75 sm:h-px sm:w-auto sm:bottom-auto"
        aria-hidden
      />
      <div className="relative flex flex-col gap-10 sm:flex-row sm:gap-6">
        {nodes.map((node, i) => (
          <motion.div key={node.title} variants={fadeUp} className="relative flex gap-4 sm:flex-1 sm:flex-col sm:gap-0">
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-base sm:mb-6">
              <span className={`h-2.5 w-2.5 rounded-full ${node.accentClass}`} aria-hidden />
            </div>
            <div className="min-w-0 pb-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-label text-tertiary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-label text-disabled">·</span>
                <span className="font-mono text-[11px] uppercase tracking-label text-tertiary">{node.chain}</span>
              </div>
              <h3 className="mt-2 font-sans text-[20px] font-semibold tracking-tight text-primary">{node.title}</h3>
              <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-secondary">{node.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
