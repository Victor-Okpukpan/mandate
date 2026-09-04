export function NotDeployed({ what }: { what: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface px-8 py-16 text-center">
      <span className="h-2 w-2 rounded-full bg-stale" aria-hidden />
      <p className="text-sm font-medium text-primary">{what} not yet deployed</p>
      <p className="text-[13px] leading-relaxed text-tertiary">
        Set <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">NEXT_PUBLIC_MANDATE_REGISTRAR</code>,{" "}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">NEXT_PUBLIC_MANDATE_ANCHOR</code>, and{" "}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">NEXT_PUBLIC_AGENT_TREASURY</code> once the
        deploy scripts have run.
      </p>
    </div>
  );
}
