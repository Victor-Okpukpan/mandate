import type { ReactNode } from "react";
import { Card } from "@mandate/ui/components/Card";

export interface StepCardProps {
  step: number;
  title: string;
  description: ReactNode;
}

export function StepCard({ step, title, description }: StepCardProps) {
  return (
    <Card padding="lg" elevated className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent opacity-[0.1] blur-2xl"
        aria-hidden
      />
      <div className="relative flex items-center gap-3">
        <span className="font-mono text-[13px] font-medium tnum text-accent">
          {String(step).padStart(2, "0")}
        </span>
        <div className="h-px flex-1 bg-border-subtle" />
      </div>
      <h3 className="relative mt-5 font-sans text-[22px] font-semibold tracking-tight text-primary">
        {title}
      </h3>
      <p className="relative mt-3 text-[15px] leading-relaxed text-secondary">{description}</p>
    </Card>
  );
}
