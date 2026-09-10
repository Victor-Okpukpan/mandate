import { cn } from "@mandate/ui/lib/cn";

export interface TimelineStep {
  id: string;
  label: string;
}

/**
 * The horizontal progress rail pinned above the onboarding wizard. Finished steps get a check and
 * a filled node, the active step is ringed, later steps are muted. Purely presentational — the
 * wizard's state machine decides `activeIndex`; this never lets anyone jump ahead by clicking.
 */
export function StepTimeline({
  steps,
  activeIndex,
}: {
  steps: TimelineStep[];
  activeIndex: number;
}) {
  return (
    <ol className="flex items-center">
      {steps.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={step.id} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-medium tnum transition-colors",
                  done && "border-live bg-live text-base",
                  active && "border-accent text-accent ring-4 ring-accent/15",
                  !done && !active && "border-border-subtle text-disabled",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap text-[11px] font-medium uppercase tracking-label",
                  active ? "text-primary" : done ? "text-secondary" : "text-disabled",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "mx-2 h-px flex-1 transition-colors",
                  done ? "bg-live" : "bg-border-subtle",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
