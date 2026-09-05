import type { ReactNode } from "react";

export interface PlaneCardProps {
  index: string;
  title: string;
  chain: string;
  description: ReactNode;
  accentClass: string;
}

export function PlaneCard({ index, title, chain, description, accentClass }: PlaneCardProps) {
  return (
    <div className="group relative rounded-2xl border border-border bg-surface p-7 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="font-mono text-3xl font-semibold tabular-nums text-tertiary transition-colors group-hover:text-secondary">
          {index}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide text-tertiary">
          <span className={`h-1.5 w-1.5 rounded-full ${accentClass}`} aria-hidden />
          {chain}
        </span>
      </div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-primary">{title}</h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-secondary">{description}</p>
    </div>
  );
}
