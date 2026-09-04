import type { ReactNode } from "react";

export interface StepCardProps {
  step: number;
  title: string;
  description: ReactNode;
}

export function StepCard({ step, title, description }: StepCardProps) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-strong font-mono text-[13px] text-secondary">
        {step}
      </div>
      <div className="pt-0.5">
        <h3 className="text-[15px] font-medium text-primary">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-secondary">{description}</p>
      </div>
    </div>
  );
}
