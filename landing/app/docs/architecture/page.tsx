import { Prose, DocsTable, DocsJsonLd } from "../_components/Prose";
import { ArchitectureDiagram } from "../_components/ArchitectureDiagram";
import { buildMetadata } from "../../../lib/seo";

const TITLE = "Architecture: authority, enforcement, and money planes";
const DESCRIPTION =
  "Why an AI agent's authority, its off-chain enforcement, and its actual money movement live on three separate planes — Sepolia, the Enforcer, and Arc — and what changed from the original design.";

export const metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: "/docs/architecture" });

export default function ArchitecturePage() {
  return (
    <Prose>
      <DocsJsonLd title={TITLE} description={DESCRIPTION} path="/docs/architecture" />
      <h1>Architecture</h1>
      <p>
        Three planes, one source of truth. Identity and permissions belong on Ethereum, where
        they&rsquo;re portable and legible to any counterparty. High-frequency machine payments
        belong on a chain where gas is USDC and settlement is deterministic. The split is the
        design, not a limitation to work around.
      </p>

      <div className="not-prose max-w-3xl">
        <ArchitectureDiagram />
      </div>

      <h2>Authority plane — Sepolia</h2>
      <p>
        <code>MandateRegistrar</code> deploys and owns its org&rsquo;s ENSv2 <code>UserRegistry</code>{" "}
        at construction. Issuing a mandate deploys a dedicated <code>PermissionedResolver</code>{" "}
        instance, writes every <code>mandate.*</code> record, registers the name with a{" "}
        <strong>zero registry-level role bitmap</strong> (soulbound, non-renewable by omission — no
        feature to disable, nothing to withhold later), then grants the agent{" "}
        <code>authorizeTextRoles</code> on exactly three keys: <code>agent.status</code>,{" "}
        <code>agent.heartbeat</code>, <code>agent.output.last</code>. Nothing under{" "}
        <code>mandate.*</code> is ever agent-writable.
      </p>
      <p>
        A sub-agent&rsquo;s mandate is created by <code>attenuate</code>, self-service by the
        parent&rsquo;s own agent wallet, and checked against the parent&rsquo;s <em>current</em>{" "}
        headroom — depth, expiry, per-tx cap, and remaining budget all narrow monotonically. The
        allowlist root is not re-supplied; it is <strong>inherited verbatim</strong> from the
        parent, which makes widening it structurally impossible rather than merely checked.
      </p>

      <h2>Enforcement plane — off-chain</h2>
      <p>
        The Enforcer watches Sepolia and propagates state into two independent enforcement points:
        a Privy conditional policy (so a wallet physically cannot sign outside its mandate) and the
        Arc anchor (so the treasury physically cannot pay outside it). It is a propagator, not an
        authority — every write it makes is EIP-712 signed and independently reproducible from the
        Sepolia state it's mirroring.
      </p>

      <h2>Money plane — Arc</h2>
      <p>
        <code>MandateAnchor</code> holds the Arc-side shadow of each agent&rsquo;s mandate.{" "}
        <code>assertSpend</code> reverts on revocation, expiry, an over-cap amount, an unlisted
        recipient, or staleness — checked in that order.{" "}
        <code>AgentTreasury</code> is the org&rsquo;s USDC pool, structured as a revolving credit
        facility: agents draw against the pool to pay a counterparty directly (never through their
        own wallet), and a leaky-bucket accumulator — not a fixed window — tracks the mandate&rsquo;s
        rolling budget.
      </p>

      <h2>What changed from the original design</h2>
      <p>Three corrections, made while implementing rather than deferred to a known-limitations list:</p>
      <DocsTable
        head={["Area", "Original design", "What shipped, and why"]}
        rows={[
          [
            "Treasury spend path",
            "A generic executor: (target, calldata) allowlisted by (target, selector).",
            "Typed payTo / fundJob. The selector-only leaf never bound the recipient — an allowlisted transfer selector could send pooled USDC anywhere.",
          ],
          [
            "Rolling budget",
            "A fixed window, spentInWindow[agent][timestamp / period].",
            "A leaky-bucket accumulator. The fixed window let a boundary be straddled for double the budget, and divided by zero at period = 0 (the spec's own lifetime-budget case).",
          ],
          [
            "Resolver init batch",
            "Every mandate.* record and agent.* grant written in one atomic multicall.",
            "Records still batch atomically; the agent.* grants run as separate calls right after — the resolver's permission-check bypass during initialize() covers direct setters, not the authorize* grant path.",
          ],
        ]}
      />
    </Prose>
  );
}
