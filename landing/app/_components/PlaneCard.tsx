import type { ReactNode } from "react";
import { Card } from "@mandate/ui/components/Card";

export interface PlaneCardProps {
  index: string;
  title: string;
  chain: string;
  description: ReactNode;
  accentClass: string;
}

export function PlaneCard({ index, title, chain, description, accentClass }: PlaneCardProps) {
  return (
    <Card padding="lg" className="group transition-shadow duration-300 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="font-sans text-3xl font-semibold tnum text-tertiary transition-colors group-hover:text-secondary">
          {index}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-label text-tertiary">
          <span className={`h-1.5 w-1.5 rounded-full ${accentClass}`} aria-hidden />
          {chain}
        </span>
      </div>
      <h3 className="mt-6 font-sans text-[22px] font-semibold tracking-tight text-primary">{title}</h3>
      <p className="mt-3 text-[15px] leading-relaxed text-secondary">{description}</p>
    </Card>
  );
}
