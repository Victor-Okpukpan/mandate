function Box({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  return (
    <div className="rounded-lg border border-border-strong bg-surface-2 p-4">
      <div className={`font-mono text-[11px] font-medium ${accent}`}>{title}</div>
      <ul className="mt-2 space-y-1.5">
        {items.map((i) => (
          <li key={i} className="font-mono text-[11px] text-secondary">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Hand-built, not a generic mermaid render — matches the rest of the design system exactly. */
export function ArchitectureDiagram() {
  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-6">
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-wide text-live">
            Sepolia — authority plane
          </p>
          <Box
            title="MandateRegistrar.sol"
            accent="text-live"
            items={["issueMandate / attenuate", "amendMandate / revokeMandate", "org's own UserRegistry"]}
          />
          <Box
            title="PermissionedResolver"
            accent="text-live"
            items={["one instance per mandate", "mandate.* — principal-only", "agent.* — per-key agent grant"]}
          />
        </div>

        <div className="flex flex-col items-center justify-center gap-3">
          <p className="font-mono text-[11px] uppercase tracking-wide text-accent">off-chain</p>
          <Box
            title="Enforcer"
            accent="text-accent"
            items={["watches Sepolia events", "writes Privy policy", "signs EIP-712 SyncPayload"]}
          />
          <div className="flex flex-col items-center gap-1 font-mono text-[10px] text-tertiary">
            <span>↓ narrows only, never widens ↓</span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-wide text-expiring">Arc — money plane</p>
          <Box
            title="MandateAnchor.sol"
            accent="text-expiring"
            items={["syncMandate (EIP-712)", "heartbeat (liveness)", "assertSpend — fails closed"]}
          />
          <Box
            title="AgentTreasury.sol"
            accent="text-expiring"
            items={["payTo / fundJob", "leaky-bucket budget", "revolving credit facility"]}
          />
        </div>
      </div>
    </div>
  );
}
