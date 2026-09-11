import { Prose, DocsJsonLd } from "./_components/Prose";
import { buildMetadata } from "../../lib/seo";

const TITLE = "How MANDATE works — spending mandates for AI agents";
const DESCRIPTION =
  "How an ENS subname becomes an AI agent's spending mandate, enforced off-chain by Privy and on-chain by Arc — the three-plane model, in one page.";

export const metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: "/docs" });

export default function DocsOverviewPage() {
  return (
    <Prose>
      <DocsJsonLd title={TITLE} description={DESCRIPTION} path="/docs" />
      <h1>How MANDATE works</h1>
      <p>
        MANDATE issues each of an organization&rsquo;s AI agents an ENSv2 subname that is
        non-transferable, self-expiring, and instantly revocable. The subname&rsquo;s resolver
        records <strong>are</strong> the agent&rsquo;s mandate — its budget, its allowlist, its
        expiry. The agent can read its own leash but is cryptographically incapable of lengthening
        it.
      </p>
      <p>
        That mandate is compiled into a Privy policy off-chain and anchored on Arc on-chain, so an
        agent&rsquo;s spending is checked twice, from one source of truth. Revoke the ENS role and
        the agent&rsquo;s next payment dies mid-flight.
      </p>

      <h2>Creating your own organisation</h2>
      <p>
        Every mandate lives under an organisation&rsquo;s own ENSv2 registry — its own name, its
        own admin, its own registrar that nobody else, including this site, can issue under.
        &ldquo;Launch app&rdquo; opens the org directory; &ldquo;Create an organisation&rdquo;
        starts one gated wizard that doesn&rsquo;t let you reach the dashboard until it&rsquo;s
        done. Six steps, in order:
      </p>
      <ol>
        <li>
          <strong>Connect.</strong> The wallet you connect becomes the organisation&rsquo;s admin —
          the address <code>MandateRegistrar.owner()</code> resolves to, and the only one that can
          issue or revoke a mandate under it afterward.
        </li>
        <li>
          <strong>Name.</strong> A label — <code>acme</code> for <code>acme.eth</code> — checked
          for real availability and priced live against ENSv2&rsquo;s own{" "}
          <code>getRegisterPrice</code>, the same call a taken name reverts against.
        </li>
        <li>
          <strong>Add funds.</strong> Three real balance checks, not assumptions: Sepolia ETH for
          gas, Sepolia USDC for the registration price, Arc USDC for the vault you&rsquo;ll create
          next. Each row links straight to a faucet if it&rsquo;s short, and the wizard won&rsquo;t
          advance until all three clear.
        </li>
        <li>
          <strong>Register.</strong> ENSv2 registers names through a commit-reveal — a real,
          enforced wait between reserving the name and finalizing it, shown as a countdown, not
          hidden behind a spinner. Once it clears, one transaction mints the name and deploys the
          org&rsquo;s own registrar.
        </li>
        <li>
          <strong>Arc vault.</strong> A second, separate deploy — the org&rsquo;s{" "}
          <code>MandateAnchor</code> and <code>AgentTreasury</code> on Arc, signed for by an
          Enforcer key. The platform default is prefilled; an org running its own Enforcer
          overrides it here.
        </li>
        <li>
          <strong>First agent.</strong> The same short form described below — name, budget,
          per-tx cap, expiry, allowlist. Finishing this step is what ends the wizard: you land on
          the dashboard with a live agent already in the tree, not an empty page.
        </li>
      </ol>
      <p>
        One honest gap: this wizard talks to <code>MandateOrgFactory</code> and{" "}
        <code>ArcVaultFactory</code> — two contracts deployed once per platform instance, not per
        organisation. Until an operator has run that one-time deploy, the wizard shows &ldquo;org
        factory not configured&rdquo; instead of the steps above.
      </p>

      <h2>Registering another agent</h2>
      <p>Once an organisation exists, adding an agent to it is short:</p>
      <ol>
        <li>
          <strong>Sign in.</strong> &ldquo;Launch app&rdquo; opens the dashboard and asks for an
          email — that&rsquo;s Privy&rsquo;s login, and it&rsquo;s how the org admin authenticates.
          No wallet or seed phrase required to sign in.
        </li>
        <li>
          <strong>Register agent.</strong> Name it, set a budget, a per-transaction cap, an
          expiry, and at least one allowlisted recipient address, then submit. A real Privy server
          wallet is provisioned for it automatically in the same step — its own address, holding
          its own keys, that you never see or manage directly — and the mandate is written to
          Sepolia as an ENS subname in one signature.
        </li>
        <li>
          <strong>Watch it land.</strong> The dashboard returns you to the tree the instant the
          transaction confirms — the new agent is already there. Click it to open its detail view:
          plain-language terms, the ENS records behind them, its Arc-side state, and (once an
          Enforcer has synced it) the actual Privy policy guarding its wallet.
        </li>
        <li>
          <strong>Revoke it.</strong> The detail view has a &ldquo;Revoke this mandate&rdquo;
          button. One transaction, and the agent&rsquo;s wallet can no longer sign a qualifying
          payment, on either enforcement layer.
        </li>
      </ol>
      <p>
        One honest gap: syncing a freshly-issued mandate onto Arc and attaching its Privy policy
        is done by a separate background service, the Enforcer — not something a visitor clicks a
        button for in this UI. That service has to be running for the drawer to show live Arc/Privy
        state; until then, a mandate exists and is fully real on Sepolia, but its money-plane
        enforcement hasn&rsquo;t been mirrored yet.
      </p>

      <h2>The problem</h2>
      <p>
        Giving an AI agent a wallet is easy. Giving it a wallet whose authority is{" "}
        <strong>bounded, provable to a counterparty, and revocable in one transaction</strong> is
        not. Off-chain policy engines (Privy&rsquo;s included) are excellent at the stateless
        half of that problem — per-transaction caps, recipient allowlists — but they are private
        to one application, cap out well below the scale a real agent economy needs, and
        Privy&rsquo;s own documentation admits their stateful rolling budgets update{" "}
        <em>after</em> a request signs, not before. See{" "}
        <a href="/docs/privy">/docs/privy</a> for the specifics.
      </p>

      <h2>The primitive</h2>
      <p>
        A mandate is an ENS subname whose properties are <strong>emergent from which roles are
        withheld</strong>, not features bolted on:
      </p>
      <ul>
        <li>No transfer-admin role → the name is soulbound to the agent it was issued to.</li>
        <li>No renew role → the name expires on schedule, and the agent cannot extend it.</li>
        <li>The parent retains the unregister role → the org can always kill it.</li>
        <li>
          Per-key resolver permissions → the agent can write its own <code>agent.status</code>,{" "}
          <code>agent.heartbeat</code>, and <code>agent.output.last</code>, and nothing under{" "}
          <code>mandate.*</code>.
        </li>
      </ul>
      <p>
        A sub-agent can delegate a strictly narrower slice of its own mandate to a sub-sub-agent —
        enforced by a monotonic-narrowing check in the registrar contract, not by convention. See{" "}
        <a href="/docs/ens">/docs/ens</a>.
      </p>

      <h2>How the three planes fit</h2>
      <p>
        Authority lives on Sepolia (ENSv2). Enforcement is an off-chain service that watches
        Sepolia and propagates — never originates — permission into a Privy policy and a signed
        Arc anchor. Money moves on Arc, checked against that anchor on every spend. Full diagram
        at <a href="/docs/architecture">/docs/architecture</a>.
      </p>
    </Prose>
  );
}
