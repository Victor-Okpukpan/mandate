import type { ReactNode } from "react";

export interface StepCardProps {
  step: number;
  title: string;
  description: ReactNode;
}

export function StepCard({ step, title, description }: StepCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-7 shadow-md">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent opacity-[0.08] blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-center gap-3">
        <span className="font-mono text-sm font-semibold tabular-nums text-accent">
          {String(step).padStart(2, "0")}
        </span>
        <div className="h-px flex-1 bg-border-subtle" />
      </div>
      <h3 className="relative mt-4 text-lg font-semibold tracking-tight text-primary">{title}</h3>
      <p className="relative mt-2.5 text-[15px] leading-relaxed text-secondary">{description}</p>
    </div>
  );
}
