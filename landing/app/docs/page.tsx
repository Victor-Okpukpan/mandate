import { Prose } from "./_components/Prose";

export const metadata = { title: "Docs" };

export default function DocsOverviewPage() {
  return (
    <Prose>
      <h1>Overview</h1>
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
          Per-key resolver permissions → the agent can write its own <code>agent.status</code>{" "}
          and <code>agent.heartbeat</code>, and nothing under <code>mandate.*</code>.
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
