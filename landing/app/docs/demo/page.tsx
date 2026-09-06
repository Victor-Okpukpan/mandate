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
    body: "Sign in with an email. Privy mints an embedded wallet — no seed phrase — and this org already controls its ENS root on Sepolia.",
  },
  {
    time: "0:30",
    title: "Issue a mandate, live",
    body: "Compose research.acme.eth on camera: budget, per-tx cap, expiry, allowlist. Submit. The subname mints with its own resolver and a new node appears on the graph — no hard-coded values.",
  },
  {
    time: "1:15",
    title: "Show the leash",
    body: "Open the triptych: ENS records, the Privy policy the Enforcer generated, the Arc anchor — three views of one fact. The agent writes its own status. It cannot write its own budget.",
  },
  {
    time: "2:00",
    title: "Let it work",
    body: "The research agent attenuates a narrower mandate to a scraper sub-agent. Agents transact: an ERC-8183 job funded from the treasury, delivered, settled, reputation written by a distinct evaluator.",
  },
  {
    time: "3:00",
    title: "The kill",
    body: "Revoke research.acme.eth. The Sepolia tx lands, the Enforcer tears down the Privy policy, the Arc anchor flips revoked — the agent's next payment is refused on-chain. The graph edge drops.",
  },
  {
    time: "3:40",
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
