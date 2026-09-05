import { Prose, Callout } from "../_components/Prose";

export const metadata = { title: "Security" };

export default function SecurityDocsPage() {
  return (
    <Prose>
      <h1>Security &amp; known limitations</h1>
      <p>
        Every limitation below is a deliberate, disclosed tradeoff — not an oversight found later.
        If something here looks like a gap, it&rsquo;s one we already knew about and chose to
        accept, and the reasoning is on this page.
      </p>

      <h2>Threat model</h2>
      <p>
        The adversary of interest is the agent itself: an LLM-driven wallet holder with a strong
        incentive to escape its own mandate — widen its budget, extend its expiry, pay an
        unlisted recipient, or outlive a revocation. Every gate in this system exists to survive
        that adversary specifically, not a passive counterparty.
      </p>

      <h2>The Enforcer trust model</h2>
      <p>
        The Enforcer is a single off-chain service holding one signing key. It can only ever{" "}
        <strong>narrow</strong> a mandate or revoke it — it has no path to widen one, because{" "}
        <code>syncMandate</code> only ever mirrors what it reads from Sepolia. But it is a
        liveness dependency: if it stops running or is censored,{" "}
        <code>MandateAnchor.assertSpend</code> fails closed once the staleness window elapses, and
        every agent freezes. This is a deliberate choice — most systems that watch a chain fail{" "}
        <em>open</em> when the watcher goes down. A frozen agent is a worse demo beat than an
        unsupervised one; it is the correct security posture.
      </p>

      <h2>Allowlist inheritance, not subset-proving</h2>
      <p>
        A sub-agent&rsquo;s allowlist root is copied verbatim from its parent&rsquo;s, rather than
        proven as a subset on-chain. Proving one merkle root is a subset of another is expensive;
        inheriting the exact root makes widening it structurally impossible instead of merely
        checked. The cost is flexibility — a sub-agent can never be given a{" "}
        <em>different</em> (even narrower, hand-picked) allowlist without going through its
        parent&rsquo;s own root.
      </p>

      <h2>Interest accrual is simple, on purpose</h2>
      <p>
        <code>AgentTreasury.accrue</code> computes simple interest and capitalizes it into
        principal on settlement. It is not compounding on a schedule, and it is the first thing
        this design would cut under time pressure — <code>draw</code>/<code>repay</code> alone
        already qualify the treasury for Arc&rsquo;s payments and treasury categories without it.
      </p>

      <h2>ERC-8183 authorization, not independently verified</h2>
      <Callout tone="warn">
        <code>AgentTreasury.fundJob</code> calls the reference Jobs contract&rsquo;s{" "}
        <code>fund(jobId, optParams)</code> after approving USDC. Its exact authorization model —
        who may fund a given job, and whether the job&rsquo;s budget must already be set by its
        creator — was confirmed from the contract&rsquo;s verified selectors, not from an
        end-to-end call against the real deployment, which needs live credentials this build was
        deliberately kept independent of. Flagged here rather than assumed silently correct.
      </Callout>

      <h2>Centralization, disclosed rather than hidden</h2>
      <p>
        Every contract&rsquo;s owner-gated function — <code>MandateRegistrar</code>&rsquo;s org
        admin, <code>MandateAnchor</code>&rsquo;s enforcer-change timelock, <code>AgentTreasury</code>
        &rsquo;s utilisation and interest settings — is currently a single EOA, appropriate only
        for a testnet demo. A mainnet deployment requires a multisig from the first transaction,
        never a deployer key.
      </p>
    </Prose>
  );
}
