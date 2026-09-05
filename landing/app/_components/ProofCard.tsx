import type { ReactNode } from "react";

export interface ProofCardProps {
  stat: string;
  label: string;
  detail: ReactNode;
}

export function ProofCard({ stat, label, detail }: ProofCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-7 shadow-sm transition-shadow hover:shadow-md">
      <div className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-primary">
        {stat}
      </div>
      <div className="mt-2 text-[13px] font-medium uppercase tracking-wide text-accent">
        {label}
      </div>
      <div className="mt-4 h-px bg-border-subtle" />
      <p className="mt-4 text-[15px] leading-relaxed text-secondary">{detail}</p>
    </div>
  );
}
