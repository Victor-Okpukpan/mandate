"use client";

import type { Hex } from "viem";
import { StatusPill, type MandateState } from "@mandate/ui/components/StatusPill";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { Countdown } from "@mandate/ui/components/Countdown";
import { Eyebrow, RuleLabel } from "@mandate/ui/components/Type";
import { fromErc20Usdc } from "@mandate/shared/decimals";
import { BINDING_KEYS } from "@mandate/shared/ensKeys";
import { useMandateDetail } from "../../lib/useMandateDetail";
import { usePrivyMandateStatus, type PrivyPolicyRule } from "../../lib/usePrivyMandateStatus";
import { useIdentityVerification } from "../../lib/useIdentityVerification";
import { useReputation } from "../../lib/useReputation";
import type { DeployedAddresses } from "../../lib/addresses";

interface MandateDetailPanelProps {
  node: Hex;
  state: MandateState;
  addresses: DeployedAddresses;
  onRevoke?: () => void;
  revoking?: boolean;
}

function RecordRow({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  const empty = value.length === 0;
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-[13px]">
      <span className="shrink-0 font-mono text-tertiary">{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-2">
        <span className={`truncate text-right font-mono ${empty ? "text-disabled" : "text-secondary"}`}>
          {empty ? "—" : value}
        </span>
        {badge}
      </span>
    </div>
  );
}

/**
 * ✓/✗ against the REAL Arc ERC-8004 IdentityRegistry, not the ENS text record's own say-so — see
 * `useIdentityVerification.ts`'s NatSpec for why `bindIdentity` alone can never be trusted as
 * verification. "unset" (no id claimed yet) renders nothing, same as an empty record.
 */
function IdentityBadge({ agentIdText, agentWallet }: { agentIdText: string; agentWallet?: `0x${string}` }) {
  const verification = useIdentityVerification(agentIdText || undefined, agentWallet);
  switch (verification.status) {
    case "unset":
      return null;
    case "loading":
      return <span className="font-mono text-[11px] text-tertiary">checking…</span>;
    case "verified":
      return (
        <span className="font-mono text-[11px] text-live" title="getAgentWallet() on the real Arc registry matches this mandate's agentWallet">
          ✓ verified
        </span>
      );
    case "not-found":
      return (
        <span className="font-mono text-[11px] text-revoked" title="No such agent id on the real Arc IdentityRegistry">
          ✗ not found
        </span>
      );
    case "mismatch":
      return (
        <span className="font-mono text-[11px] text-revoked" title={`Registry says this id's wallet is ${verification.realWallet}`}>
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

function Plane({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3 className="mt-1 font-sans text-[19px] font-semibold tracking-tight text-primary">{title}</h3>
      <div className="mt-3 divide-y divide-border-subtle border-t border-border-subtle">{children}</div>
    </section>
  );
}

/**
 * The ENS / Privy / Arc triptych — the same three-plane read used both inline (the tree drawer)
 * and at the standalone `/agent/[name]` deep link, via `useMandateDetail`. One component, one
 * source of truth for what a mandate "is" across all three surfaces.
 */
export function MandateDetailPanel({ node, state, addresses, onRevoke, revoking }: MandateDetailPanelProps) {
  const { mandate, agentWallet, mandateRecords, agentRecords, bindingRecords, anchor, account } =
    useMandateDetail(node, addresses);
  const privy = usePrivyMandateStatus(agentWallet);
  const erc8004IdText = bindingRecords.find((r) => r.key === BINDING_KEYS.erc8004Id)?.value;
  const reputation = useReputation(erc8004IdText);

  const budgetTotal = mandate ? fromErc20Usdc(mandate.terms.budgetTotal) : undefined;
  const spent = account ? fromErc20Usdc(account[0]) : undefined;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="flex items-center gap-2.5">
          <StatusPill state={state} pulse={state === "live"} />
          {mandate ? (
            <Countdown expiresAt={Number(mandate.terms.expiry)} urgency={state === "revoked" ? "revoked" : undefined} />
          ) : null}
        </div>
        <p className="mt-3 font-mono text-[15px] font-medium tracking-tight text-primary">
          <MonoValue value={node} truncate={12} />
        </p>
        {agentWallet ? (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-tertiary">
            agent wallet
            <MonoValue value={agentWallet} className="text-secondary" />
          </p>
        ) : null}
        {budgetTotal ? (
          <p className="mt-3 text-[13px] text-secondary">
            <span className="font-mono tnum text-primary">${spent ?? "0"}</span> of{" "}
            <span className="font-mono tnum">${budgetTotal}</span> USDC committed
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

      <RuleLabel>Authority · Sepolia</RuleLabel>
      <Plane eyebrow="ENS resolver records" title="mandate.*">
        {mandateRecords.map((r) => (
          <RecordRow key={r.key} label={r.key} value={r.value} />
        ))}
      </Plane>
      <Plane eyebrow="Agent-writable" title="agent.*">
        {agentRecords.map((r) => (
          <RecordRow key={r.key} label={r.key} value={r.value} />
        ))}
      </Plane>
      <Plane eyebrow="Principal-written · identity, not authority" title="agent.arc.wallet / erc8004 / model">
        {bindingRecords.map((r) => (
          <RecordRow
            key={r.key}
            label={r.key}
            value={r.value}
            badge={
              r.key === BINDING_KEYS.erc8004Id ? (
                <IdentityBadge agentIdText={r.value} agentWallet={agentWallet} />
              ) : undefined
            }
          />
        ))}
        {reputation.status === "available" ? (
          <RecordRow
            label="erc8004 reputation"
            value={`${reputation.averageValue.toFixed(2)} avg · ${reputation.count} feedback`}
          />
        ) : reputation.status === "no-feedback" ? (
          <RecordRow label="erc8004 reputation" value="no feedback yet" />
        ) : null}
      </Plane>

      <RuleLabel>Enforcement · Privy</RuleLabel>
      <Plane eyebrow={privy.wallet ? `Wallet ${privy.wallet.id}` : "Server wallet"} title="Signing policy">
        {!privy.privyConfigured ? (
          <p className="py-3 text-[13px] text-tertiary">
            Privy isn&rsquo;t configured on this deployment (missing NEXT_PUBLIC_PRIVY_APP_ID).
          </p>
        ) : !privy.signedIn ? (
          <p className="py-3 text-[13px] text-tertiary">Sign in to read this agent&rsquo;s live policy.</p>
        ) : privy.walletLoading ? (
          <p className="py-3 text-[13px] text-tertiary">Looking up the Privy wallet…</p>
        ) : !agentWallet ? (
          <p className="py-3 text-[13px] text-tertiary">Reading this mandate&rsquo;s agent wallet…</p>
        ) : !privy.wallet ? (
          <p className="py-3 text-[13px] text-tertiary">
            No Privy server wallet found for <MonoValue value={agentWallet} className="text-secondary" /> —
            it wasn&rsquo;t provisioned through this app, or belongs to a different Privy app.
          </p>
        ) : privy.policyLoading ? (
          <p className="py-3 text-[13px] text-tertiary">Reading the attached policy…</p>
        ) : !privy.policy ? (
          <p className="py-3 text-[13px] text-tertiary">
            Wallet found, no policy attached yet — the Enforcer syncs one from this mandate&rsquo;s
            terms the next time it processes an event for this node.
          </p>
        ) : (
          <>
            {privy.policy.rules.map((rule) => (
              <PolicyRuleRow key={rule.id} rule={rule} />
            ))}
          </>
        )}
      </Plane>

      <RuleLabel>Money · Arc testnet</RuleLabel>
      <Plane eyebrow="MandateAnchor" title="Enforcement">
        {anchor ? (
          <>
            <RecordRow label="revoked" value={anchor[8] ? "true" : "false"} />
            <RecordRow label="updatedAt" value={anchor[6]?.toString() ?? ""} />
            <RecordRow label="nonce" value={anchor[7]?.toString() ?? ""} />
          </>
        ) : (
          <p className="py-3 text-[13px] text-tertiary">No Arc-side anchor yet — the Enforcer syncs
            this after the mandate is issued.</p>
        )}
      </Plane>
      <Plane eyebrow="AgentTreasury" title="Ledger">
        {account ? (
          <>
            <RecordRow label="spentAccum" value={fromErc20Usdc(account[0])} />
            <RecordRow label="principal" value={fromErc20Usdc(account[1])} />
          </>
        ) : (
          <p className="py-3 text-[13px] text-tertiary">No treasury account opened yet.</p>
        )}
      </Plane>
    </div>
  );
}
