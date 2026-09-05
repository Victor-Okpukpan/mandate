import type { ReactNode } from "react";
import { Card } from "@mandate/ui/components/Card";

export interface ProofCardProps {
  stat: string;
  label: string;
  detail: ReactNode;
}

export function ProofCard({ stat, label, detail }: ProofCardProps) {
  return (
    <Card padding="lg" className="h-full transition-shadow duration-300 hover:shadow-md">
      <div className="font-sans text-4xl font-semibold tracking-tight text-primary">{stat}</div>
      <div className="mt-2 font-mono text-[12px] font-medium uppercase tracking-label text-accent">
        {label}
      </div>
      <div className="mt-5 h-px bg-border-subtle" />
      <p className="mt-5 text-[15px] leading-relaxed text-secondary">{detail}</p>
    </Card>
  );
}
