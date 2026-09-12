/**
 * The hero's product shot — two overlapping panels standing in for real screenshots, hand-built
 * from the same primitives the actual dashboard uses (StatusPill colors, mono values, the same
 * card chrome) rather than a rendered PNG. No nodes, no edges, no lines connecting anything —
 * this is deliberately NOT a diagram. It's two mocked-up windows, the same structure Safe uses
 * (a wide dashboard panel + a narrower card overlapping its corner), showing the two real things
 * this product does: list an org's mandates, and show the on-chain check that actually guards one
 * of them. `MandateAnchor.assertSpend` is what's actually authoritative — the only enforcement
 * layer this deployment runs, so that's the card shown, not a stand-in for a layer that isn't
 * doing the work.
 */

function WindowChrome({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-border-subtle px-4 py-3">
      <span className="h-2.5 w-2.5 rounded-full bg-revoked/50" aria-hidden />
      <span className="h-2.5 w-2.5 rounded-full bg-expiring/50" aria-hidden />
      <span className="h-2.5 w-2.5 rounded-full bg-live/50" aria-hidden />
      <span className="ml-2 font-mono text-[11px] text-tertiary">{url}</span>
    </div>
  );
}

/** Mirrors the real dashboard table's five columns (Name / State / Agent wallet / Budget /
 *  Expires) exactly — see `web/app/_components/MandateTree.tsx` — not a simplified stand-in. */
function MandateRow({
  name,
  state,
  wallet,
  budget,
  expires,
}: {
  name: string;
  state: "root" | "live" | "revoked";
  wallet: string;
  budget: string;
  expires: string;
}) {
  return (
    <div className="grid grid-cols-[1.6fr_0.9fr_1.3fr_0.9fr_0.8fr] items-center gap-2 border-b border-border-subtle px-4 py-2.5 last:border-0">
      <span className="truncate font-mono text-[12px] text-primary">{name}</span>
      {state === "root" ? (
        <span className="font-mono text-[10px] uppercase tracking-label text-tertiary">org root</span>
      ) : (
        <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${state === "live" ? "text-live" : "text-revoked"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${state === "live" ? "bg-live" : "bg-revoked"}`} />
          {state === "live" ? "Live" : "Revoked"}
        </span>
      )}
      <span className="truncate font-mono text-[11px] text-secondary">{wallet}</span>
      <span className="font-mono text-[11px] tabular-nums text-secondary">{budget}</span>
      <span className="font-mono text-[11px] tabular-nums text-tertiary">{expires}</span>
    </div>
  );
}

export function ProductShot() {
  return (
    <div className="relative mx-auto w-full max-w-3xl" data-theme="dark">
      {/* Back panel: the mandate list, exactly the shape of the real dashboard's home route. */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
        <WindowChrome url="app.runmandate.xyz" />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-mono text-[11px] text-tertiary">acme.eth</span>
          <span className="rounded-md bg-accent px-2.5 py-1 font-mono text-[10px] font-medium text-on-accent">
            Register agent
          </span>
        </div>
        <div className="grid grid-cols-3 gap-px bg-border-subtle px-4 pb-2">
          {[
            ["Live", "1"],
            ["Revoked", "1"],
            ["Total", "2"],
          ].map(([label, value]) => (
            <div key={label} className="bg-surface py-2">
              <p className="font-mono text-[10px] uppercase tracking-label text-tertiary">{label}</p>
              <p className="mt-0.5 font-mono text-[18px] font-medium text-primary">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-1">
          <div className="grid grid-cols-[1.6fr_0.9fr_1.3fr_0.9fr_0.8fr] gap-2 border-b border-border-subtle px-4 pb-1.5">
            {["Name", "State", "Agent wallet", "Budget", "Expires"].map((h) => (
              <span key={h} className="font-mono text-[10px] uppercase tracking-label text-disabled">
                {h}
              </span>
            ))}
          </div>
          <MandateRow name="acme.eth" state="root" wallet="—" budget="$500 committed" expires="—" />
          <MandateRow name="researcher" state="live" wallet="0xA794…9EB0C9" budget="$500" expires="6d 23h" />
          <MandateRow name="ops" state="revoked" wallet="0x6f2A…e3AD" budget="$500" expires="—" />
        </div>
        {/* Blank floor, not decorative filler — gives the front panel below somewhere to overlap
            that isn't a row of actual data. Without this the front card's top edge lands right on
            top of the stat numbers or a mandate row, clipping real text instead of floating over
            empty space the way Safe's own overlapping card does. */}
        <div className="h-36 sm:h-40" aria-hidden />
      </div>

      {/* Front panel: the on-chain check from the mandate drawer's "On-chain protection" section —
          the thing that makes this product real rather than a claim, and the layer that's actually
          authoritative today. Overlaps only the blank floor above and hangs below the back panel's
          own edge, same as Safe's mobile card overlapping its desktop shot. */}
      <div className="absolute -bottom-4 -right-4 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-xl sm:-right-8 sm:w-72">
        <div className="border-b border-border-subtle px-4 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-label text-tertiary">
            Arc · on-chain check
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="font-mono text-[11px] text-secondary">assertSpend()</p>
          <div className="mt-2 flex flex-col gap-1 border-l border-border-subtle pl-3">
            <span className="font-mono text-[10px] text-tertiary">
              revoked <span className="text-secondary">false</span>
            </span>
            <span className="font-mono text-[10px] text-tertiary">
              per-tx cap <span className="text-secondary">$50.00</span>
            </span>
            <span className="font-mono text-[10px] text-tertiary">
              allowlist <span className="text-secondary">1 recipient</span>
            </span>
          </div>
          <p className="mt-3 font-mono text-[11px] font-medium uppercase tracking-label text-live">
            ✓ payment allowed
          </p>
        </div>
      </div>
    </div>
  );
}
