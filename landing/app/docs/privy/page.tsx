import { Prose, DocsTable, DocsJsonLd, Callout } from "../_components/Prose";
import { buildMetadata } from "../../../lib/seo";

const TITLE = "Privy wallet policies for AI agents, and their limits";
const DESCRIPTION =
  "What Privy's conditional wallet policies enforce for an AI agent's spending, where those limits stop, and why a rolling cumulative budget still needs an onchain ledger alongside them.";

export const metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: "/docs/privy" });

export default function PrivyDocsPage() {
  return (
    <Prose>
      <DocsJsonLd title={TITLE} description={DESCRIPTION} path="/docs/privy" />
      <h1>Privy — a spend management tool for organizations</h1>
      <Callout tone="warn">
        Everything below describes the design's intended enforcement split. Right now, only the Arc
        half is live: Arc testnet isn&rsquo;t yet on Privy&rsquo;s per-app relay allowlist, and any
        policy attached to a wallet blocks it from signing on Arc at all — so agent wallets
        currently carry no Privy policy, and <code>MandateAnchor</code>/<code>AgentTreasury</code>{" "}
        on Arc are the sole active enforcement. See{" "}
        <a href="/docs/security">/docs/security</a> for the full explanation and what flips this
        back on.
      </Callout>
      <p>
        Privy still does real work today — it&rsquo;s the custodian: agent wallets are Privy server
        wallets, no seed phrase ever held by anyone. The conditional-policy layer described below is
        what currently sits disabled, not Privy&rsquo;s custody of the key itself.
      </p>

      <h2>Organization wallets, mapped onto directly</h2>
      <p>Privy&rsquo;s own primitives already do most of what a naive rebuild would reinvent:</p>
      <DocsTable
        head={["MANDATE concept", "Privy primitive"]}
        rows={[
          ["The company", "Organization (id, name, default key quorum)"],
          ["An agent's authority tier", "A key quorum, attached with override_policy_ids"],
          ["The mandate's caps and allowlist", "A conditional policy on that quorum"],
          ["Routine mandate sync", "The Enforcer calling update policy rules directly"],
          ["Issuing or raising a mandate", "An intent — proposed, then signed asynchronously by humans"],
          ["Agent transacting", "A session signer on the scoped wallet"],
        ]}
      />

      <h2>The enforcement split — designed, not currently both live</h2>
      <p>
        Privy&rsquo;s stateful policies do support cumulative rolling spend caps, via aggregations.
        The constraints are real: a maximum of ten aggregations per app, no per-wallet{" "}
        <code>group_by</code>, and a 72-hour window ceiling. Privy&rsquo;s own documentation states
        aggregation values update <em>after</em> a request is successfully signed, not before —
        concurrent requests can all pass before any of them records.
      </p>
      <DocsTable
        head={["Enforcement", "Where it's meant to live", "Why"]}
        rows={[
          [
            "Per-tx cap, recipient allowlist, chain restriction",
            "Privy (currently disabled — see the callout above)",
            "Stateless rules, unlimited in number, evaluated before signature.",
          ],
          [
            "Cumulative rolling budget",
            "AgentTreasury on Arc — the active layer today",
            "Privy caps at ~10 agents with rolling budgets, can't scope per wallet, can't exceed 72h, and races under concurrency.",
          ],
        ]}
      />
      <p>
        By design these are not symmetric gates or defense in depth — that phrasing implies
        redundancy that isn&rsquo;t there. They&rsquo;re meant to be a fast stateless pre-filter and
        an authoritative stateful ledger, with two different jobs. Today, with the pre-filter
        disabled, the ledger is doing both jobs alone — still fully real, still fails closed, just
        without the earlier stateless check in front of it.
      </p>

      <h2>Intents govern the humans, policies govern the agents</h2>
      <p>
        A human raising an agent&rsquo;s budget needs other humans to approve, asynchronously —
        that&rsquo;s an intent. An agent spending within its already-approved budget needs nobody —
        that&rsquo;s a policy. Revoking a mandate automatically dismisses any pending intent against
        it, without anyone cancelling it by hand.
      </p>

      <h2>Business workflows, all three present</h2>
      <ul>
        <li>
          <strong>Wallet administration</strong> — issuing, amending, and revoking a mandate through
          the org&rsquo;s key quorum.
        </li>
        <li>
          <strong>Treasury operation</strong> — drawing, spending, and repaying against the
          revolving credit facility.
        </li>
        <li>
          <strong>Payment</strong> — agent-to-agent and agent-to-vendor settlement in USDC on Arc.
        </li>
      </ul>
    </Prose>
  );
}
