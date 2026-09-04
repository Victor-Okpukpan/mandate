"use client";

import { useEffect, useState } from "react";

/**
 * The landing page's one showpiece: a self-contained, deterministic miniature of the authority
 * graph replaying the kill. Canned data, no wallet, no RPC, no SDK — the point is that a judge
 * understands what MANDATE does within seconds, without opening the observatory. Everything here
 * is illustrative of real mechanics (see the docs for the real thing): revoke lands on Sepolia,
 * the Enforcer tears the edge down, the next payment is refused.
 */

type Phase = "live" | "revoking" | "revoked" | "resetting";

const TIMELINE: Array<{ phase: Phase; ms: number }> = [
  { phase: "live", ms: 3200 },
  { phase: "revoking", ms: 500 },
  { phase: "revoked", ms: 3800 },
  { phase: "resetting", ms: 700 },
];

export function KillSequenceHero() {
  const [phase, setPhase] = useState<Phase>("live");

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // A local closure variable, not a ref: each effect run (including React StrictMode's
    // dev-only double-invoke) gets its own clean index rather than sharing mutable state across
    // separately-scheduled timer chains.
    let index = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const advance = () => {
      const step = TIMELINE[index % TIMELINE.length]!;
      setPhase(step.phase);
      index += 1;
      timeoutId = setTimeout(advance, step.ms);
    };
    // Fires almost immediately: sets phase to TIMELINE[0] (matching the initial state, so no
    // visible flicker) and — critically — schedules the NEXT transition off TIMELINE[0]'s own
    // duration, rather than double-counting an extra wait before the first real transition.
    timeoutId = setTimeout(advance, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  const researchKilled = phase === "revoked" || phase === "revoking";
  const researchDot = phase === "revoking" ? "fill-expiring" : researchKilled ? "fill-revoked" : "fill-live";
  const researchStroke =
    phase === "revoking" ? "stroke-expiring" : researchKilled ? "stroke-revoked" : "stroke-live";
  const researchEdgeClass = researchKilled ? "stroke-revoked/40" : "stroke-border-strong";
  const researchEdgeDash = researchKilled ? "6 5" : undefined;

  return (
    <div className="relative w-full max-w-xl select-none">
      <svg
        viewBox="0 0 480 260"
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="Animated diagram: an organization revokes an AI agent's mandate, and its edge on the authority graph drops."
      >
        {/* edges */}
        <line
          x1="240"
          y1="46"
          x2="120"
          y2="150"
          className={`transition-colors duration-500 ${researchEdgeClass}`}
          strokeWidth="1.5"
          strokeDasharray={researchEdgeDash}
        />
        <line x1="240" y1="46" x2="360" y2="150" className="stroke-border-strong" strokeWidth="1.5" />

        {/* root: acme.eth */}
        <g transform="translate(240,32)">
          <rect x="-46" y="-14" width="92" height="28" rx="8" className="fill-surface-2 stroke-border-strong" />
          <text textAnchor="middle" dy="4" className="fill-primary text-[11px] font-mono font-medium">
            acme.eth
          </text>
        </g>

        {/* research.acme.eth — the one that gets killed */}
        <g transform="translate(120,168)" className="transition-transform duration-300">
          <circle r="30" className={`fill-surface-2 stroke-2 transition-colors duration-500 ${researchStroke}`} />
          <circle cx="0" cy="-38" r="4" className={`transition-colors duration-300 ${researchDot}`} />
          <text textAnchor="middle" dy="-2" className="fill-primary text-[10px] font-mono">
            research
          </text>
          <text textAnchor="middle" dy="12" className="fill-tertiary text-[9px] font-mono tabular-nums">
            {researchKilled ? "$0 / day" : "$500 / day"}
          </text>
        </g>

        {/* ops.acme.eth — stays live throughout, the contrast element */}
        <g transform="translate(360,168)">
          <circle r="30" className="fill-surface-2 stroke-live stroke-2" />
          <circle cx="0" cy="-38" r="4" className="fill-live animate-pulse-live" />
          <text textAnchor="middle" dy="-2" className="fill-primary text-[10px] font-mono">
            ops
          </text>
          <text textAnchor="middle" dy="12" className="fill-tertiary text-[9px] font-mono tabular-nums">
            $200 / day
          </text>
        </g>

        {/* revoke callout */}
        <g
          transform="translate(120,168)"
          className={`transition-opacity duration-300 ${
            phase === "revoked" ? "opacity-100" : "opacity-0"
          }`}
        >
          <text textAnchor="middle" dy="62" className="fill-revoked text-[10px] font-mono font-medium">
            payment refused on-chain
          </text>
        </g>
      </svg>

      <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[11px] text-tertiary">
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
            phase === "live" ? "bg-live" : phase === "revoking" ? "bg-expiring" : "bg-revoked"
          }`}
        />
        <span>
          {phase === "live" && "research.acme.eth — mandate active"}
          {phase === "revoking" && "org revokes research.acme.eth…"}
          {(phase === "revoked" || phase === "resetting") && "revoked — next payment blocked mid-flight"}
        </span>
      </div>
    </div>
  );
}
