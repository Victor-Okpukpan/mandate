import { Prose, DocsTable } from "../_components/Prose";

export const metadata = { title: "Privy" };

export default function PrivyDocsPage() {
  return (
    <Prose>
      <h1>Privy — a spend management tool for organizations</h1>
      <p>
        Remove Privy and agents cannot sign at all. It is one of two independent enforcement gates
        a payment must clear, not a convenience wrapped around a seed phrase.
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

      <h2>The enforcement split — verified, not assumed</h2>
      <p>
        Privy&rsquo;s stateful policies do support cumulative rolling spend caps, via aggregations.
        The constraints are real: a maximum of ten aggregations per app, no per-wallet{" "}
        <code>group_by</code>, and a 72-hour window ceiling. Privy&rsquo;s own documentation states
        aggregation values update <em>after</em> a request is successfully signed, not before —
        concurrent requests can all pass before any of them records.
      </p>
      <DocsTable
        head={["Enforcement", "Where it lives", "Why"]}
        rows={[
          [
            "Per-tx cap, recipient allowlist, chain restriction",
            "Privy",
            "Stateless rules, unlimited in number, evaluated before signature.",
          ],
          [
            "Cumulative rolling budget",
            "AgentTreasury on Arc",
            "Privy caps at ~10 agents with rolling budgets, can't scope per wallet, can't exceed 72h, and races under concurrency.",
          ],
        ]}
      />
      <p>
        These are not symmetric gates or defense in depth — that phrasing implies redundancy that
        isn&rsquo;t there. They are a fast stateless pre-filter and an authoritative stateful
        ledger, with two different jobs.
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
