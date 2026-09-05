import { Card } from "@mandate/ui/components/Card";

export function NotDeployed({ what }: { what: string }) {
  return (
    <Card padding="lg" className="max-w-md border-dashed text-center">
      <span className="mx-auto mb-3 block h-2 w-2 rounded-full bg-stale" aria-hidden />
      <p className="text-[14px] font-medium text-primary">{what} not yet deployed</p>
      <p className="mt-2 text-[13px] leading-relaxed text-tertiary">
        Set <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">NEXT_PUBLIC_MANDATE_REGISTRAR</code>,{" "}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">NEXT_PUBLIC_MANDATE_ANCHOR</code>, and{" "}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">NEXT_PUBLIC_AGENT_TREASURY</code> once the
        deploy scripts have run.
      </p>
    </Card>
  );
}
