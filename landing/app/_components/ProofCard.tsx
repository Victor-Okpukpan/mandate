import type { ReactNode } from "react";

export interface ProofCardProps {
  stat: string;
  label: string;
  detail: ReactNode;
}

export function ProofCard({ stat, label, detail }: ProofCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="font-mono text-2xl font-medium tabular-nums text-primary">{stat}</div>
      <div className="mt-1 text-[13px] font-medium text-accent">{label}</div>
      <p className="mt-3 text-sm leading-relaxed text-secondary">{detail}</p>
    </div>
  );
}
