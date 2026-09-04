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
    <div className="relative rounded-xl border border-border bg-surface p-6">
      <div className={`absolute left-0 top-6 h-8 w-0.5 rounded-full ${accentClass}`} aria-hidden />
      <div className="pl-4">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xs text-tertiary">{index}</span>
          <span className="font-mono text-[11px] uppercase tracking-wide text-tertiary">{chain}</span>
        </div>
        <h3 className="mt-2 text-[15px] font-medium text-primary">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-secondary">{description}</p>
      </div>
    </div>
  );
}
