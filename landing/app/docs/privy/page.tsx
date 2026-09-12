import { Prose, DocsTable, DocsJsonLd } from "../_components/Prose";
import { buildMetadata } from "../../../lib/seo";

const TITLE = "Privy wallet custody for AI agents";
const DESCRIPTION =
  "What Privy actually does in this system: server wallet custody with no seed phrase ever held by anyone, optional key quorums, and human-approval intents for org-level actions.";

export const metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: "/docs/privy" });

export default function PrivyDocsPage() {
  return (
    <Prose>
      <DocsJsonLd title={TITLE} description={DESCRIPTION} path="/docs/privy" />
      <h1>Privy — wallet custody for organizations</h1>
      <p>
        Remove Privy and agents cannot sign at all. Every agent wallet is a real Privy server
        wallet — its own address, holding its own keys — provisioned the moment an agent is
        registered. No human ever holds or sees the key.
      </p>

      <h2>Organization wallets, mapped onto directly</h2>
      <p>Privy&rsquo;s own primitives already do most of what a naive rebuild would reinvent:</p>
      <DocsTable
        head={["MANDATE concept", "Privy primitive"]}
        rows={[
          ["The company", "Organization (id, name, default key quorum)"],
          ["An agent's authority tier", "A key quorum, attached with override_policy_ids"],
          ["Issuing or raising a mandate", "An intent — proposed, then signed asynchronously by humans"],
          ["Agent transacting", "A session signer on the scoped wallet"],
        ]}
      />

      <h2>Intents govern the humans</h2>
      <p>
        A human raising an agent&rsquo;s budget needs other humans to approve, asynchronously —
        that&rsquo;s an intent, built on Privy key quorums (<code>/org/[org]/approvals</code>).
        Revoking a mandate automatically dismisses any pending intent against it, without anyone
        cancelling it by hand. The agent&rsquo;s own spending, once a mandate is issued, is checked
        entirely on-chain — see <a href="/docs/arc">/docs/arc</a>.
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
