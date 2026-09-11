import { Prose, DocsTable, Callout, DocsJsonLd } from "../_components/Prose";
import { buildMetadata } from "../../../lib/seo";

const TITLE = "ENS subnames as AI agent permissions";
const DESCRIPTION =
  "How an ENSv2 subname becomes an AI agent's entire spending authority — soulbound, self-expiring, and readable but not editable by the agent it names.";

export const metadata = buildMetadata({ title: TITLE, description: DESCRIPTION, path: "/docs/ens" });

export default function EnsDocsPage() {
  return (
    <Prose>
      <DocsJsonLd title={TITLE} description={DESCRIPTION} path="/docs/ens" />
      <h1>ENS — central, not cosmetic</h1>
      <p>
        Delete the ENSv2 layer from this project and there is no product left. Every mandate{" "}
        <strong>is</strong> an ENS subname; every permission it carries comes from ENSv2&rsquo;s
        Enhanced Access Control, not from a database this app happens to keep in sync with a name.
      </p>

      <h2>The role-omission table</h2>
      <p>
        A name&rsquo;s properties are emergent from which roles are withheld at registration —
        never features implemented after the fact:
      </p>
      <DocsTable
        head={["Property", "How it's achieved"]}
        rows={[
          ["Non-transferable", "No ROLE_CAN_TRANSFER_ADMIN in the roleBitmap passed to register()."],
          ["Self-expiring", "No ROLE_RENEW — only the registrar (org-controlled) can extend expiry."],
          ["Revocable by the org", "MandateRegistrar always holds ROLE_UNREGISTER at the registry root."],
          [
            "Agent owns some records",
            "authorizeTextRoles() grants ROLE_SET_TEXT scoped to exactly three keys.",
          ],
        ]}
      />
      <p>
        Admin roles are settable only at a name&rsquo;s registration — never again afterward. Get
        the bitmap right at <code>issueMandate</code>; there is no second chance, which is exactly
        the property that makes soulbound-by-omission trustworthy rather than merely convenient.
      </p>

      <h2>Agents as namespaces</h2>
      <p>
        On its first <code>attenuate</code> call, a mandate deploys its own <code>UserRegistry</code>{" "}
        via ENSv2&rsquo;s <code>VerifiableFactory</code> and wires it as that name&rsquo;s
        subregistry — making the agent a genuine namespace root for its own sub-agents, not a leaf
        with a flat list of children. This is ENSv2&rsquo;s bonus criterion, and it&rsquo;s load-bearing
        here: attenuation depth and per-child registries are how a research agent can safely hire a
        scraper agent without the org writing a single extra line of ENS state by hand.
      </p>

      <h2>Per-key resolver permissions</h2>
      <p>
        Each mandate gets its own dedicated <code>PermissionedResolver</code> instance.{" "}
        <code>authorizeTextRoles(name, "agent.status", agentWallet, true)</code> grants exactly
        that key — not the whole name, not a set of keys. The agent can report{" "}
        <code>agent.status</code>, <code>agent.heartbeat</code>, and{" "}
        <code>agent.output.last</code>; it is cryptographically incapable of writing{" "}
        <code>mandate.budget.total</code>, verified directly against the live ENSv2 Sepolia
        deployment.
      </p>

      <Callout tone="warn">
        A verified, real integration finding: the resolver&rsquo;s <code>initialize()</code>{" "}
        skips permission checks for direct setters (<code>setText</code> et al.) but not for the{" "}
        <code>authorize*Roles</code> grant path — <code>multicall</code>&rsquo;s delegatecall relay
        preserves the deploying factory as <code>msg.sender</code> throughout the whole batch. Agent
        grants run as separate calls immediately after deployment instead of inside the same
        multicall, once <code>MandateRegistrar</code> is genuinely the caller. Full writeup in{" "}
        <a href="/docs/architecture">/docs/architecture</a>.
      </Callout>

      <h2>No hard-coded values</h2>
      <p>
        Every ENSv2 address — RootRegistry, ETHRegistry, VerifiableFactory,
        PermissionedResolverImpl, UserRegistryImpl — is loaded from environment configuration, and
        every mandate in the demo is authored live in the observatory, not seeded from a fixture.
      </p>
    </Prose>
  );
}
