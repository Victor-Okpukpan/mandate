"use client";

import { useState } from "react";
import type { Address, Hex } from "viem";
import { StatusPill, type MandateState } from "@mandate/ui/components/StatusPill";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { Countdown } from "@mandate/ui/components/Countdown";
import { fromErc20Usdc } from "@mandate/shared/decimals";
import { BINDING_KEYS } from "@mandate/shared/ensKeys";
import { useMandateDetail } from "../../lib/useMandateDetail";
import { usePrivyMandateStatus, useOptionalPrivy, type PrivyPolicyRule } from "../../lib/usePrivyMandateStatus";
import { useIdentityVerification } from "../../lib/useIdentityVerification";
import { useReputation } from "../../lib/useReputation";
import { usePaymentsFeed } from "../../lib/usePaymentsFeed";
import type { DeployedAddresses } from "../../lib/addresses";

const ARC_EXPLORER_TX = "https://testnet.arcscan.app/tx";

interface MandateDetailPanelProps {
  node: Hex;
  state: MandateState;
  addresses: DeployedAddresses;
  /** e.g. "researcher.acme.eth" — falls back to the raw node hash when the caller hasn't
   *  resolved a label yet (labels come from a separate multicall; see `useMandateLabels`). */
  displayName?: string;
  /** Needed only to issue a scoped agent token — see `ConnectAgentSection` below. */
  registrar?: Address;
  isOrgAdmin?: boolean;
  onRevoke?: () => void;
  revoking?: boolean;
}

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-[13px]">
      <span className="shrink-0 text-tertiary">{label}</span>
      <span className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-secondary">{value}</span>
        {hint ? <span className="text-[11px] text-disabled">{hint}</span> : null}
      </span>
    </div>
  );
}

/** The literal on-chain ENS text record — for anyone who wants to verify this isn't a UI story.
 *  Collapsed by default; the plain-language rows above it are the ones meant to be read. */
function RawRecordRow({ label, value }: { label: string; value: string }) {
  const empty = value.length === 0;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[12px]">
      <span className="shrink-0 font-mono text-tertiary">{label}</span>
      <span className={`truncate text-right font-mono ${empty ? "text-disabled" : "text-secondary"}`}>
        {empty ? "—" : value}
      </span>
    </div>
  );
}

/**
 * ✓/✗ against the REAL Arc ERC-8004 IdentityRegistry, not the ENS text record's own say-so — see
 * `useIdentityVerification.ts`'s NatSpec for why `bindIdentity` alone can never be trusted as
 * verification. "unset" (no id claimed yet) renders nothing, same as an empty record.
 */
function IdentityBadge({ agentIdText, agentWallet }: { agentIdText: string | undefined; agentWallet?: `0x${string}` }) {
  const verification = useIdentityVerification(agentIdText, agentWallet);
  switch (verification.status) {
    case "unset":
      return null;
    case "loading":
      return <span className="text-[11px] text-tertiary">checking…</span>;
    case "verified":
      return (
        <span className="text-[11px] text-live" title="Confirmed against the real Arc identity registry, not just this mandate's own say-so">
          ✓ verified
        </span>
      );
    case "not-found":
      return (
        <span className="text-[11px] text-revoked" title="No such agent id on the real Arc identity registry">
          ✗ not found
        </span>
      );
    case "mismatch":
      return (
        <span className="text-[11px] text-revoked" title={`The registry says this id belongs to a different wallet (${verification.realWallet})`}>
          ✗ wallet mismatch
        </span>
      );
  }
}

/** One Privy policy rule, rendered as the actual condition it compiles to — "ALLOW
 *  eth_sendTransaction if payTo.amount lte 50000000" — not just a name, since the name alone is
 *  exactly what hid the "two disjoint ALLOW rules" bug this plane exists to make impossible to miss
 *  again. `DENY *` rules with no conditions render as a bare line; that's what a revoked mandate's
 *  policy collapses to. */
function PolicyRuleRow({ rule }: { rule: PrivyPolicyRule }) {
  return (
    <div className="py-2.5 text-[13px]">
      <div className="flex items-center gap-2">
        <span
          className={`font-mono text-[11px] font-medium uppercase tracking-label ${
            rule.action === "ALLOW" ? "text-live" : "text-revoked"
          }`}
        >
          {rule.action}
        </span>
        <span className="font-mono text-secondary">{rule.method}</span>
      </div>
      {rule.conditions.length > 0 ? (
        <div className="mt-1.5 flex flex-col gap-1 border-l border-border-subtle pl-3">
          {rule.conditions.map((c, i) => (
            <span key={i} className="font-mono text-[12px] text-tertiary">
              {c.field} <span className="text-secondary">{c.operator}</span>{" "}
              {Array.isArray(c.value) ? `[${c.value.length} recipient${c.value.length === 1 ? "" : "s"}]` : c.value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Issues a scoped `mandate-agent-sdk` connection token for this one agent wallet — the admin-only
 * alternative to an external agent process ever holding this platform's own Privy credentials. See
 * `web/app/api/agents/connect/route.ts` for the ownership check and `web/lib/agentToken.ts` for
 * what the token actually grants (nothing beyond what the wallet's own on-chain mandate allows).
 */
function ConnectAgentSection({ registrar, ensName, agentWallet }: { registrar: Address; ensName: string; agentWallet: Address }) {
  const privy = useOptionalPrivy();
  const [state, setState] = useState<{ status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "done"; token: string }>({
    status: "idle",
  });

  async function handleConnect() {
    setState({ status: "loading" });
    try {
      if (!privy) throw new Error("Privy isn't configured on this deployment.");
      const accessToken = await privy.getAccessToken();
      if (!accessToken) throw new Error("Sign in first.");
      const res = await fetch("/api/agents/connect", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ registrar, ensName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setState({ status: "done", token: body.token as string });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const snippet = state.status === "done"
    ? `import { connectMandate, makeApiSigner } from "mandate-agent-sdk";

const signer = makeApiSigner({
  token: "${state.status === "done" ? state.token : ""}",
  address: "${agentWallet}",
  baseUrl: "${typeof window !== "undefined" ? window.location.origin : "https://app.runmandate.xyz"}",
});

const agent = await connectMandate({ ensName: "${ensName}", signer });
await agent.pay(recipient, "10.00");`
    : "";

  return (
    <Section title="Connect your agent" subtitle="A scoped credential for this wallet only — never this platform's own Privy keys.">
      {state.status === "done" ? (
        <div className="py-3">
          <p className="text-[13px] text-secondary">
            Token issued. It only ever authorizes <MonoValue value={agentWallet} className="text-secondary" copyable /> —
            paste it into your agent's environment and drop the snippet below into your own runtime.
          </p>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2">
            <MonoValue value={state.token} truncate={16} copyable />
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-border-subtle bg-surface-2 px-3 py-2.5 text-[11.5px] leading-relaxed text-secondary">
            {snippet}
          </pre>
        </div>
      ) : (
        <div className="py-3">
          <button
            type="button"
            onClick={handleConnect}
            disabled={state.status === "loading"}
            className="inline-flex h-9 w-fit items-center rounded-lg border border-border px-4 text-[13px] font-medium text-primary transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-40"
          >
            {state.status === "loading" ? "Generating…" : "Generate connection token"}
          </button>
          {state.status === "error" ? <p className="mt-2 text-[12.5px] text-revoked">{state.message}</p> : null}
        </div>
      )}
    </Section>
  );
}

/**
 * This agent's own slice of the org-wide `AgentSpent` feed (`usePaymentsFeed`), each row linking
 * straight to Arcscan — proof a payment actually landed, not just a UI claim. Live-only, same as
 * the feed it filters: a page reload loses rows older than the recent-window seed, since Arc's
 * public RPC won't serve a real historical log range (see `usePaymentsFeed`'s own NatSpec).
 */
function TransactionHistorySection({ agentTreasury, agentWallet }: { agentTreasury: Address; agentWallet: Address }) {
  const { rows, loading } = usePaymentsFeed(agentTreasury);
  const mine = rows.filter((r) => r.agent.toLowerCase() === agentWallet.toLowerCase());

  return (
    <Section title="Transaction history" subtitle="Live from Arc — reload loses anything older than a few thousand blocks.">
      {loading ? (
        <p className="py-3 text-[13px] text-tertiary">Loading…</p>
      ) : mine.length === 0 ? (
        <p className="py-3 text-[13px] text-tertiary">No payments yet. A spend lands here live.</p>
      ) : (
        mine.map((r) => (
          <div key={`${r.txHash}-${r.recipient}-${r.amount}`} className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-tertiary">to</span>
              <MonoValue value={r.recipient} className="text-secondary" copyable />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-mono tnum text-primary">${fromErc20Usdc(r.amount)}</span>
              <a
                href={`${ARC_EXPLORER_TX}/${r.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-accent underline-offset-2 hover:underline"
              >
                View →
              </a>
            </div>
          </div>
        ))
      )}
    </Section>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="font-sans text-[16px] font-semibold tracking-tight text-primary">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-[12.5px] text-tertiary">{subtitle}</p> : null}
      <div className="mt-3 divide-y divide-border-subtle border-t border-border-subtle">{children}</div>
    </section>
  );
}

function formatBudgetPeriod(periodSeconds: number): string {
  if (periodSeconds === 0) return "Never — this is a lifetime budget";
  const days = Math.round(periodSeconds / 86_400);
  return days === 1 ? "Every day" : `Every ${days} days`;
}

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * The ENS / Privy / Arc triptych — the same three-plane read used both inline (the tree drawer)
 * and at the standalone `/agent/[name]` deep link, via `useMandateDetail`. One component, one
 * source of truth for what a mandate "is" across all three surfaces.
 *
 * Rewritten to lead with plain sentences ("Resets every 7 days", "3 addresses allowed") rather
 * than the raw `mandate.budget.perTx`-style ENS key names — those still exist, just folded into
 * the "Raw record" disclosure at the bottom for anyone who wants to verify this isn't a UI story.
 */
export function MandateDetailPanel({ node, state, addresses, displayName, registrar, isOrgAdmin, onRevoke, revoking }: MandateDetailPanelProps) {
  const {
    mandate,
    agentWallet,
    mandateRecords,
    agentRecords,
    bindingRecords,
    allowedRecipients,
    anchor,
    account,
  } = useMandateDetail(node, addresses);
  const privy = usePrivyMandateStatus(agentWallet);
  const erc8004IdRaw = bindingRecords.find((r) => r.key === BINDING_KEYS.erc8004Id)?.value;
  const model = bindingRecords.find((r) => r.key === BINDING_KEYS.model)?.value;
  const arcWallet = bindingRecords.find((r) => r.key === BINDING_KEYS.arcWallet)?.value;
  // "" and "0" both mean "no id claimed" — never send either to the registry as a lookup, and
  // never show a reputation score that isn't actually this agent's (a bare "0" resolves to a real,
  // unrelated agent's reputation on the live registry, which is worse than showing nothing).
  const erc8004Id = erc8004IdRaw && erc8004IdRaw !== "0" ? erc8004IdRaw : undefined;
  const reputation = useReputation(erc8004Id);

  const budgetTotal = mandate ? fromErc20Usdc(mandate.terms.budgetTotal) : undefined;
  const perTxCap = mandate ? fromErc20Usdc(mandate.terms.perTxCap) : undefined;
  const spent = account ? fromErc20Usdc(account[0]) : undefined;
  const owed = account && account[1] > 0n ? fromErc20Usdc(account[1]) : undefined;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="flex items-center gap-2.5">
          <StatusPill state={state} pulse={state === "live"} />
          {/* A countdown next to "Revoked" reads as "still ticking toward something" — it isn't,
              revocation already ended it, so the live clock only ever shows for a state where the
              remaining time is still the actual reason it might stop working. */}
          {mandate && state !== "revoked" ? (
            <Countdown expiresAt={Number(mandate.terms.expiry)} />
          ) : null}
        </div>
        <p className="mt-3 font-sans text-[17px] font-semibold tracking-tight text-primary">
          {displayName ?? <MonoValue value={node} truncate={10} />}
        </p>
        {agentWallet ? (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-tertiary">
            wallet
            <MonoValue value={agentWallet} className="text-secondary" copyable />
          </p>
        ) : null}
        {budgetTotal ? (
          <p className="mt-3 text-[13px] text-secondary">
            <span className="font-mono tnum text-primary">${spent ?? "0"}</span> of{" "}
            <span className="font-mono tnum">${budgetTotal}</span> USDC spent
          </p>
        ) : null}
      </header>

      {onRevoke && state !== "revoked" ? (
        <button
          type="button"
          onClick={onRevoke}
          disabled={revoking}
          className="inline-flex h-9 w-fit items-center rounded-lg border border-revoked/35 px-4 text-[13px] font-medium text-revoked transition-colors hover:bg-revoked-subtle hover:border-revoked/70 disabled:pointer-events-none disabled:opacity-40"
        >
          {revoking ? "Revoking…" : "Revoke this mandate"}
        </button>
      ) : null}

      {mandate ? (
        <Section title="What this agent can do" subtitle="Set when the mandate was issued — the agent cannot change any of this.">
          <Row label="Total budget" value={`$${budgetTotal} USDC`} />
          <Row label="Per-payment limit" value={`$${perTxCap} USDC`} />
          <Row label="Budget resets" value={formatBudgetPeriod(mandate.terms.budgetPeriod)} />
          <Row label="Expires" value={state === "revoked" ? "Revoked before expiry" : formatDate(Number(mandate.terms.expiry))} />
          <Row
            label="Can delegate to sub-agents"
            value={mandate.terms.maxDepth > 0 ? `Yes, up to ${mandate.terms.maxDepth} level${mandate.terms.maxDepth === 1 ? "" : "s"} deep` : "No"}
          />
        </Section>
      ) : null}

      <Section title="Who it can pay" subtitle="Any payment to an address not on this list is rejected on-chain, regardless of amount.">
        {allowedRecipients.length === 0 ? (
          <p className="py-3 text-[13px] text-tertiary">
            No addresses allowed yet — as written, this mandate can&rsquo;t pay anyone.
          </p>
        ) : (
          allowedRecipients.map((addr) => (
            <div key={addr} className="flex items-center justify-between py-2 text-[13px]">
              <MonoValue value={addr} className="text-secondary" copyable />
            </div>
          ))
        )}
      </Section>

      <Section title="What the agent has reported" subtitle="Written by the agent itself — a status line, not a spending permission.">
        <Row label="Status" value={agentRecords.find((r) => r.key === "agent.status")?.value || "Nothing reported yet"} />
        <Row label="Last heartbeat" value={agentRecords.find((r) => r.key === "agent.heartbeat")?.value || "—"} />
        <Row label="Last output" value={agentRecords.find((r) => r.key === "agent.output.last")?.value || "—"} />
      </Section>

      <Section title="Identity" subtitle="Optional — who the agent claims to be, checked against the real registry, not just its own say-so.">
        <Row label="AI model" value={model || "Not stated"} />
        <Row
          label="ERC-8004 identity"
          value={
            <span className="flex items-center gap-1.5">
              {erc8004Id ?? "Not registered"}
              <IdentityBadge agentIdText={erc8004Id} agentWallet={agentWallet} />
            </span>
          }
        />
        {reputation.status === "available" ? (
          <Row label="Reputation" value={`${reputation.averageValue.toFixed(2)} / 100 · ${reputation.count} reviews`} />
        ) : reputation.status === "no-feedback" ? (
          <Row label="Reputation" value="No feedback yet" />
        ) : null}
        {arcWallet && arcWallet.toLowerCase() !== (agentWallet ?? "").toLowerCase() ? (
          <Row label="Separate Arc spending wallet" value={<MonoValue value={arcWallet} copyable />} />
        ) : null}
      </Section>

      {isOrgAdmin && registrar && agentWallet && state !== "revoked" && displayName ? (
        <ConnectAgentSection registrar={registrar} ensName={displayName} agentWallet={agentWallet} />
      ) : null}

      <Section title="Off-chain protection" subtitle="Privy checks the recipient and payment size before the agent's wallet ever signs.">
        {!privy.privyConfigured ? (
          <p className="py-3 text-[13px] text-tertiary">Privy isn&rsquo;t configured on this deployment.</p>
        ) : !privy.signedIn ? (
          <p className="py-3 text-[13px] text-tertiary">Sign in to see this agent&rsquo;s live protection status.</p>
        ) : privy.walletLoading ? (
          <p className="py-3 text-[13px] text-tertiary">Checking…</p>
        ) : !agentWallet ? (
          <p className="py-3 text-[13px] text-tertiary">Reading this mandate&rsquo;s wallet…</p>
        ) : !privy.wallet ? (
          <p className="py-3 text-[13px] text-tertiary">
            No wallet found for <MonoValue value={agentWallet} className="text-secondary" /> — it
            wasn&rsquo;t provisioned through this app.
          </p>
        ) : privy.policyLoading ? (
          <p className="py-3 text-[13px] text-tertiary">Checking…</p>
        ) : !privy.policy ? (
          <p className="py-3 text-[13px] text-tertiary">
            Not protected yet — the Enforcer attaches this the next time it processes an event for
            this mandate.
          </p>
        ) : (
          <>
            {privy.policy.rules.map((rule) => (
              <PolicyRuleRow key={rule.id} rule={rule} />
            ))}
          </>
        )}
      </Section>

      <Section title="On-chain protection" subtitle="The Arc contracts check every payment for real — this is what actually stops a bad one, whether or not Privy caught it first.">
        {anchor && anchor[6] > 0n ? (
          <Row label="Synced to Arc" value={anchor[8] ? "Yes, and revoked there too" : "Yes, live"} />
        ) : (
          <p className="py-3 text-[13px] text-tertiary">
            Not synced to Arc yet — the Enforcer mirrors this mandate onto Arc the next time it
            processes an event for this node.
          </p>
        )}
        {owed ? <Row label="Owed back to the treasury" value={`$${owed} USDC`} hint="A short-term credit facility, not overspending — see the docs." /> : null}
      </Section>

      {agentWallet && addresses.agentTreasury ? (
        <TransactionHistorySection agentTreasury={addresses.agentTreasury} agentWallet={agentWallet} />
      ) : null}

      <details className="group">
        <summary className="cursor-pointer text-[12px] font-medium text-tertiary transition-colors hover:text-secondary">
          Raw on-chain record
        </summary>
        <div className="mt-3 divide-y divide-border-subtle border-t border-border-subtle">
          <RawRecordRow label="node" value={node} />
          {mandateRecords.map((r) => (
            <RawRecordRow key={r.key} label={r.key} value={r.value} />
          ))}
        </div>
      </details>
    </div>
  );
}
