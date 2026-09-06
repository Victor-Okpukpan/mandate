import { Prose, DocsTable, Callout, DocsJsonLd } from "../_components/Prose";
import { buildMetadata } from "../../../lib/seo";

const TITLE = "Arc: USDC-gas payments for autonomous agents";
const DESCRIPTION =
  "Why an AI agent's payments settle on Arc, where gas is USDC and the org treasury behaves as a revolving credit facility — plus how ERC-8004 and ERC-8183 compose into it.";

export const metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: "/docs/arc" });

export default function ArcDocsPage() {
  return (
    <Prose>
      <DocsJsonLd title={TITLE} description={DESCRIPTION} path="/docs/arc" />
      <h1>Arc: USDC-gas payments for agents</h1>
      <p>
        MANDATE enters both Arc bounties, explicitly: <strong>Best Agentic Economy</strong> (via
        ERC-8004 identity/reputation and ERC-8183 job escrow, built from the Circle Agent Stack)
        and <strong>Best DeFi Stablecoin-Native Pool</strong> (via the treasury&rsquo;s revolving
        credit facility and conditional, multi-step settlement).
      </p>

      <h2>USDC is gas and unit of account</h2>
      <p>
        Arc&rsquo;s USDC is both the native gas token and an ERC-20, at the same address, with{" "}
        <strong>different decimals</strong> — 18 for the native path, 6 for the ERC-20 path.
        Verified empirically on-chain: the same account&rsquo;s native balance and ERC-20 balance
        differ by exactly 10<sup>12</sup>. Every conversion in this codebase goes through one named
        helper; nothing inlines the arithmetic.
      </p>

      <h2>The treasury as a credit facility</h2>
      <p>
        Agents never hold float beyond a small, hard-capped gas draw. <code>AgentTreasury</code>{" "}
        pays a counterparty directly from the pool via <code>payTo</code> or funds an ERC-8183 job
        via <code>fundJob</code> — checked against <code>MandateAnchor</code> first, then against
        the mandate&rsquo;s own leaky-bucket rolling budget, then against the pool&rsquo;s
        utilisation cap. Every dollar that leaves the pool accrues interest to the org until{" "}
        <code>repay</code>&rsquo;d — a spending mandate and a credit limit are the same object.
      </p>

      <h2>Advanced programmable money flows</h2>
      <ul>
        <li>Conditional payments — every spend gated by revocation, expiry, cap, and allowlist.</li>
        <li>On-chain rolling budgets — a leaky-bucket accumulator, not a database counter.</li>
        <li>Multi-step settlement — treasury → escrow (ERC-8183) → provider, in one call.</li>
      </ul>

      <h2>ERC-8004 and ERC-8183, composed rather than reimplemented</h2>
      <p>
        Identity, reputation, and job escrow all reuse Arc&rsquo;s reference deployments directly.
        The reference Jobs contract&rsquo;s <code>hook</code> extension point is admin-gated — this
        design was never built around it. <code>ReputationRegistry.giveFeedback</code> is
        third-party-only by the standard&rsquo;s own design, so the demo&rsquo;s evaluator is a
        distinct key from the job&rsquo;s participants.
      </p>

      <DocsTable
        head={["Category", "How it's met"]}
        rows={[
          ["Payments", "payTo / fundJob — every spend checked against the anchor and the budget."],
          ["Treasury", "AgentTreasury's pooled USDC, utilisation-capped, interest-accruing."],
          ["Lending / borrowing", "draw / repay against the mandate's own budget as a credit limit."],
        ]}
      />

      <Callout tone="warn">
        USYC (the yield-bearing asset) is fully permissioned on Arc testnet — a treasury contract
        cannot even hold it without a Circle-granted entitlement, verified on-chain. Yield is
        dropped from this design entirely rather than mocked; payments and treasury alone qualify
        the DeFi-pool bounty under its own published criteria.
      </Callout>
    </Prose>
  );
}
