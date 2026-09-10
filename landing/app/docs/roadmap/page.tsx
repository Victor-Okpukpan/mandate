import { Prose, DocsJsonLd } from "../_components/Prose";
import { buildMetadata } from "../../../lib/seo";

const TITLE = "Roadmap — what's next for MANDATE";
const DESCRIPTION =
  "What the current version does not yet ship: agent-to-agent commerce via ERC-8183 escrow jobs, sub-delegation in the UI, and wallet-ownership quorums as a first-class step.";

export const metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: "/docs/roadmap" });

export default function RoadmapDocsPage() {
  return (
    <Prose>
      <DocsJsonLd title={TITLE} description={DESCRIPTION} path="/docs/roadmap" />
      <h1>Roadmap</h1>
      <p>
        The current version does one thing well: a company issues an agent a spending mandate,
        two independent layers enforce it, and revoking the ENS name kills the agent. The
        pieces below are built or half-built in the codebase but deliberately kept out of the
        product surface for now.
      </p>

      <h2>Agent-to-agent commerce (ERC-8183 jobs)</h2>
      <p>
        An agent posts a job, funds an escrow from its treasury, another agent delivers the work,
        and a third-party evaluator releases payment. The <code>AgentTreasury</code> job methods
        and the Jobs feed already exist; the next version puts them in front of users, so a
        mandate can authorize not just direct payments but hiring.
      </p>

      <h2>Sub-delegation in the UI</h2>
      <p>
        An agent issuing a strictly-narrower mandate to a sub-agent is enforced on-chain today
        (<code>MandateRegistrar.attenuate</code> — the contract rejects anything not smaller in
        every dimension) but has no interface. Next version: delegate from the dashboard, and see
        the sub-tree.
      </p>

      <h2>Wallet-ownership quorums</h2>
      <p>
        By default an agent&rsquo;s Privy wallet is ownerless — anyone holding the app secret could
        alter its policy. A signing quorum closes that so only the Enforcer can. It works today via
        setup scripts; the next version makes it a step in onboarding rather than an advanced path.
      </p>
    </Prose>
  );
}
