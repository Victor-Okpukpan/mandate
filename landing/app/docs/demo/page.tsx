import { Prose } from "../_components/Prose";
import { buildMetadata } from "../../../lib/seo";

// A presenter's run-of-show for a live walkthrough — no search value, and already unlinked from
// the footer (see Footer.tsx's own comment). noindex, not excluded from the sitemap by omission
// alone: this keeps that intent explicit here too, next to the metadata it governs.
export const metadata = buildMetadata({
  title: "Live demo walkthrough",
  description: "A timed run-of-show for a live MANDATE demo.",
  path: "/docs/demo",
  index: false,
});

const BEATS: Array<{ time: string; title: string; body: string }> = [
  {
    time: "0:00",
    title: "Onboard",
    body: "Sign in with an email. Privy mints an embedded wallet — no seed phrase. Pick a name; the wizard runs the whole ENSv2 registration and Arc vault deploy, gated end to end.",
  },
  {
    time: "1:00",
    title: "Register an agent, live",
    body: "Last step of the same wizard: name the agent, set budget/per-tx cap/expiry/allowlist, submit. A real Privy wallet is provisioned in that same step, and the mandate mints as an ENS subname — no hard-coded values, no seed script.",
  },
  {
    time: "1:45",
    title: "Fund the treasury",
    body: "From the dashboard: deposit USDC into the org's Arc vault. This is what the agent will actually draw against.",
  },
  {
    time: "2:15",
    title: "Let it spend — allowed",
    body: "Run agents/demo-spend: a real payment, within cap, to an allowlisted address. It lands on-chain — no LLM in the loop, the point is watching the contract, not a model.",
  },
  {
    time: "2:45",
    title: "Let it spend — blocked, twice",
    body: "Same script, over the per-tx cap: reverts. Same script, to an address that isn't allowlisted: reverts. Neither is a client-side check — the contract itself refuses both.",
  },
  {
    time: "3:15",
    title: "The kill",
    body: "Revoke the mandate on the dashboard. Re-run the exact payment that succeeded two minutes ago — same amount, same recipient. It now reverts. That's the whole pitch in one repeated command.",
  },
  {
    time: "3:45",
    title: "Kill the Enforcer instead",
    body: "Stop the Enforcer process. Every agent freezes within the staleness window on its own. A dead supervisor stops the agents; it doesn't free them.",
  },
];

export default function DemoDocsPage() {
  return (
    <Prose>
      <h1>Demo</h1>
      <p>
        Video will be embedded here once recorded against a live deployment. The beat-by-beat
        script below is the actual sequence it follows — every step against the real, deployed
        contracts, nothing staged.
      </p>

      <div className="not-prose mt-8 flex aspect-video max-w-2xl items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface text-sm text-tertiary">
        Demo video — coming with the live deployment
      </div>

      <h2>Script</h2>
      <div className="mt-6 space-y-6">
        {BEATS.map((b) => (
          <div key={b.time} className="flex gap-4">
            <span className="w-12 shrink-0 font-mono text-[13px] tabular-nums text-tertiary">{b.time}</span>
            <div>
              <p className="text-[15px] font-medium text-primary">{b.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-secondary">{b.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Prose>
  );
}
