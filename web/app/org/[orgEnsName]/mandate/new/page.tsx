"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { sepolia } from "viem/chains";
import { parseUnits, type Address } from "viem";
import { MandateRegistrarAbi } from "@mandate/shared/abis";
import { buildAllowlist } from "@mandate/shared/merkle";
import { MANDATE_KEYS, AGENT_KEYS } from "@mandate/shared/ensKeys";
import type { OrgWithVault } from "@mandate/shared/orgs";
import { Button } from "@mandate/ui/components/Button";
import { Card } from "@mandate/ui/components/Card";
import { Field, Input, Textarea } from "@mandate/ui/components/Field";
import { Display, Eyebrow, Lede, RuleLabel } from "@mandate/ui/components/Type";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { SkeletonRows } from "@mandate/ui/components/Skeleton";
import { useSelectedOrg } from "@/lib/useSelectedOrg";
import { useOptionalPrivy } from "@/lib/usePrivyMandateStatus";
import { useIsOrgAdmin } from "@/lib/useIsOrgAdmin";
import { OrgNotFound } from "@/app/_components/OrgNotFound";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

interface RecordPreviewRow {
  key: string;
  value: string;
  pending?: boolean;
}

/** The exact resolver record set `issueMandate` will write, computed live from form state — the
 *  point of this panel is that there is nothing hidden between what you typed and what lands
 *  on-chain. `mandate.allow.root` is a merkle root, so it's the one row that can't render until
 *  the allowlist textarea contains at least one syntactically valid address. */
function useRecordPreview(args: {
  budgetTotal: string;
  perTxCap: string;
  budgetPeriodDays: string;
  expiryDays: string;
  maxDepth: string;
  allowlist: string;
}): { rows: RecordPreviewRow[]; allowlistError?: string } {
  return useMemo(() => {
    const recipients = args.allowlist
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const invalid = recipients.filter((r) => !ADDRESS_RE.test(r));

    let allowRoot = "—";
    let allowlistError: string | undefined;
    if (recipients.length === 0) {
      allowRoot = "(add a recipient below)";
    } else if (invalid.length > 0) {
      allowlistError = `Not a valid address: ${invalid[0]}`;
      allowRoot = "(fix the invalid address below)";
    } else {
      allowRoot = buildAllowlist(recipients as Address[]).root;
    }

    const expirySeconds = Math.floor(Date.now() / 1000) + (Number(args.expiryDays) || 0) * 86_400;

    const rows: RecordPreviewRow[] = [
      { key: MANDATE_KEYS.version, value: "1" },
      {
        key: MANDATE_KEYS.budgetTotal,
        value: `${parseUnits(args.budgetTotal || "0", 6).toString()} (${args.budgetTotal || "0"} USDC)`,
      },
      {
        key: MANDATE_KEYS.budgetPerTx,
        value: `${parseUnits(args.perTxCap || "0", 6).toString()} (${args.perTxCap || "0"} USDC)`,
      },
      {
        key: MANDATE_KEYS.budgetPeriod,
        value: `${(Number(args.budgetPeriodDays) || 0) * 86_400}s${
          Number(args.budgetPeriodDays) === 0 ? " (lifetime — never decays)" : ""
        }`,
      },
      { key: MANDATE_KEYS.expires, value: `${expirySeconds}` },
      { key: MANDATE_KEYS.depth, value: args.maxDepth || "0" },
      { key: MANDATE_KEYS.allowRoot, value: allowRoot, pending: recipients.length === 0 || invalid.length > 0 },
      {
        key: MANDATE_KEYS.allowHuman,
        value: recipients.length > 0 ? JSON.stringify(recipients.map((r) => ({ target: r }))) : "—",
      },
    ];

    return { rows, allowlistError };
  }, [args.budgetTotal, args.perTxCap, args.budgetPeriodDays, args.expiryDays, args.maxDepth, args.allowlist]);
}

function NewMandateForm({ org }: { org: OrgWithVault }) {
  const router = useRouter();
  const privy = useOptionalPrivy();
  const { isAdmin, owner, isConnected, loading: adminLoading } = useIsOrgAdmin(org.registrar);

  const [label, setLabel] = useState("");
  const [agentWallet, setAgentWallet] = useState("");
  const [arcWallet, setArcWallet] = useState("");
  const [walletsDiffer, setWalletsDiffer] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | undefined>();
  const [provisionedWalletId, setProvisionedWalletId] = useState<string | undefined>();

  const [budgetTotal, setBudgetTotal] = useState("500");
  const [perTxCap, setPerTxCap] = useState("50");
  const [budgetPeriodDays, setBudgetPeriodDays] = useState("1");
  const [expiryDays, setExpiryDays] = useState("7");
  const [maxDepth, setMaxDepth] = useState("2");
  const [allowlist, setAllowlist] = useState("");
  const [allowlistError, setAllowlistError] = useState<string | undefined>();

  const { rows: previewRows, allowlistError: previewAllowlistError } = useRecordPreview({
    budgetTotal,
    perTxCap,
    budgetPeriodDays,
    expiryDays,
    maxDepth,
    allowlist,
  });

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: sepolia.id,
  });

  /**
   * The step that never existed anywhere in this repo: creating the agent's actual wallet. Calls
   * `POST /api/agents/provision` (a real `walletApi.createWallet`, verified live against the
   * project's own Privy app), then fills both address fields — one wallet serves as both the
   * ENS-side `agentWallet` and the Arc-side `arcWallet` unless "use a different Arc wallet" is
   * checked. The wallet has no policy yet; it gets one the moment the Enforcer syncs this mandate.
   */
  async function handleProvision() {
    setProvisionError(undefined);
    if (!privy) {
      setProvisionError("Privy isn't configured on this deployment.");
      return;
    }
    setProvisioning(true);
    try {
      const token = await privy.getAccessToken();
      if (!token) throw new Error("Sign in first — provisioning needs an authenticated session.");
      const res = await fetch("/api/agents/provision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Provisioning failed (${res.status})`);
      setAgentWallet(body.address);
      if (!walletsDiffer) setArcWallet(body.address);
      setProvisionedWalletId(body.walletId);
    } catch (err) {
      setProvisionError(err instanceof Error ? err.message : String(err));
    } finally {
      setProvisioning(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAllowlistError(undefined);

    const recipients = allowlist
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const invalid = recipients.filter((r) => !ADDRESS_RE.test(r));
    if (recipients.length === 0) {
      setAllowlistError("Add at least one allowlisted recipient address.");
      return;
    }
    if (invalid.length > 0) {
      setAllowlistError(`Not a valid address: ${invalid[0]}`);
      return;
    }

    const tree = buildAllowlist(recipients as Address[]);
    const allowHumanJson = JSON.stringify(recipients.map((r) => ({ target: r })));

    const terms = {
      allowlistRoot: tree.root,
      budgetTotal: parseUnits(budgetTotal || "0", 6),
      perTxCap: parseUnits(perTxCap || "0", 6),
      expiry: BigInt(Math.floor(Date.now() / 1000) + Number(expiryDays) * 86_400),
      budgetPeriod: Number(budgetPeriodDays) * 86_400,
      maxDepth: Number(maxDepth),
    };

    writeContract({
      address: org.registrar,
      abi: MandateRegistrarAbi,
      functionName: "issueMandate",
      args: [label, agentWallet as Address, terms, arcWallet as Address, allowHumanJson],
      chainId: sepolia.id,
    });
  }

  // Rendered after every hook above has already run — this only changes what shows, never what
  // `issueMandate`'s own `onlyOwner` check allows. A non-admin previously saw the full composer
  // and only found out they couldn't issue anything after signing and sending a transaction that
  // was always going to revert; this tells them up front, before they've spent any gas.
  if (!adminLoading && !isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Eyebrow>Authority plane · Sepolia</Eyebrow>
        <Display as="h1" size="sm" className="mt-2">
          Admin only
        </Display>
        <Card padding="lg" className="mt-6">
          <p className="text-[14px] text-secondary">
            {isConnected
              ? "The connected wallet isn't this org's admin — only its registrar owner may issue a mandate."
              : "Connect this org's admin wallet to issue a mandate."}
          </p>
          {owner ? (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-tertiary">
              admin wallet
              <MonoValue value={owner} className="text-secondary" />
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <Eyebrow>Authority plane · Sepolia</Eyebrow>
      <Display as="h1" size="sm" className="mt-2">
        Issue a mandate
      </Display>
      <Lede className="mt-3">
        Every field on the left becomes a resolver record on the right, under {org.orgEnsName} —
        the mandate is nothing more or less than what gets written here.
      </Lede>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <Card padding="lg">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <Field
              label="Label"
              required
              hint={`The subname, e.g. “research” for research.${org.orgEnsName}`}
            >
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="research" required />
            </Field>

            <div className="rounded-lg border border-border-subtle bg-surface-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] uppercase tracking-label text-tertiary">Agent wallet</p>
                <Button type="button" variant="secondary" size="sm" onClick={handleProvision} disabled={provisioning}>
                  {provisioning ? "Provisioning…" : provisionedWalletId ? "Provision another" : "Provision a wallet"}
                </Button>
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-tertiary">
                Creates a real Privy server wallet — no seed phrase ever leaves Privy. The agent
                signs from it, and the Enforcer attaches this mandate&rsquo;s policy to it once issued.
              </p>
              {provisionError ? <p className="mt-2 text-[12px] text-revoked-strong">{provisionError}</p> : null}
              {provisionedWalletId ? (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-tertiary">
                  Privy wallet id <MonoValue value={provisionedWalletId} className="text-secondary" />
                </p>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-3">
                <Field
                  label="Address"
                  required
                  hint={
                    provisionedWalletId
                      ? "Locked — this is the real Privy wallet just provisioned. Click “Provision another” to replace it, rather than editing the address by hand."
                      : "Paste an existing wallet's address, or click “Provision a wallet” above to create one."
                  }
                >
                  <Input
                    mono
                    value={agentWallet}
                    onChange={(e) => {
                      setAgentWallet(e.target.value);
                      if (!walletsDiffer) setArcWallet(e.target.value);
                    }}
                    placeholder="0x…"
                    required
                    readOnly={Boolean(provisionedWalletId)}
                    className={provisionedWalletId ? "cursor-not-allowed opacity-70" : undefined}
                  />
                </Field>
                <label className="flex items-center gap-2 text-[12px] text-secondary">
                  <input
                    type="checkbox"
                    checked={walletsDiffer}
                    onChange={(e) => setWalletsDiffer(e.target.checked)}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  Use a different wallet for spending on Arc
                </label>
                {walletsDiffer ? (
                  <Field label="Arc wallet" required hint="Spending key on Arc">
                    <Input
                      mono
                      value={arcWallet}
                      onChange={(e) => setArcWallet(e.target.value)}
                      placeholder="0x…"
                      required
                    />
                  </Field>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-5">
              <Field label="Budget total" hint="USDC">
                <Input
                  mono
                  type="number"
                  min="0"
                  value={budgetTotal}
                  onChange={(e) => setBudgetTotal(e.target.value)}
                />
              </Field>
              <Field label="Per-tx cap" hint="USDC">
                <Input
                  mono
                  type="number"
                  min="0"
                  value={perTxCap}
                  onChange={(e) => setPerTxCap(e.target.value)}
                />
              </Field>
              <Field label="Budget period" hint="Days · 0 = lifetime">
                <Input
                  mono
                  type="number"
                  min="0"
                  value={budgetPeriodDays}
                  onChange={(e) => setBudgetPeriodDays(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <Field label="Expires in" hint="Days">
                <Input
                  mono
                  type="number"
                  min="1"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                />
              </Field>
              <Field label="Sub-delegation depth" hint="0 = may not attenuate">
                <Input
                  mono
                  type="number"
                  min="0"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Allowlisted recipients"
              required
              error={allowlistError}
              hint="One address per line — becomes the merkle allowlist root, and the Privy policy's own recipient condition once the Enforcer syncs it"
            >
              <Textarea
                mono
                invalid={Boolean(allowlistError)}
                value={allowlist}
                onChange={(e) => setAllowlist(e.target.value)}
                placeholder={"0x0747EEf0706327138c69792bF28Cd525089e4583"}
              />
            </Field>

            <div className="flex items-center gap-4 pt-2">
              <Button type="submit" disabled={isPending || confirming}>
                {isPending ? "Confirm in wallet…" : confirming ? "Minting…" : "Issue mandate"}
              </Button>
              {confirmed && (
                <button
                  type="button"
                  onClick={() => router.push(`/org/${org.orgEnsName}`)}
                  className="text-[13px] text-accent hover:underline"
                >
                  View in the tree →
                </button>
              )}
            </div>
            {error && <p className="text-[13px] text-revoked-strong">{error.message}</p>}
          </form>
        </Card>

        <div className="lg:sticky lg:top-6">
          <Card padding="lg">
            <RuleLabel>Will be written · mandate.*</RuleLabel>
            <div className="mt-3 divide-y divide-border-subtle border-t border-border-subtle">
              {previewRows.map((row) => (
                <div key={row.key} className="flex items-baseline justify-between gap-4 py-2 text-[13px]">
                  <span className="shrink-0 font-mono text-tertiary">{row.key}</span>
                  <span
                    className={`truncate text-right font-mono ${row.pending ? "text-disabled" : "text-secondary"}`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            {previewAllowlistError ? (
              <p className="mt-3 text-[12px] text-revoked-strong">{previewAllowlistError}</p>
            ) : null}

            <div className="mt-6">
              <RuleLabel>Agent may write</RuleLabel>
              <div className="mt-3 flex flex-col gap-1.5">
                {Object.values(AGENT_KEYS).map((key) => (
                  <span key={key} className="font-mono text-[12px] text-tertiary">
                    {key}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[12px] leading-snug text-tertiary">
                One `authorizeTextRoles` grant per key — never a name-level role, and never any
                `mandate.*` key.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function NewMandatePage({ params }: { params: Promise<{ orgEnsName: string }> }) {
  const { orgEnsName } = use(params);
  const { org, loading, notFound } = useSelectedOrg(decodeURIComponent(orgEnsName));

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <SkeletonRows rows={3} />
      </div>
    );
  }

  if (notFound || !org) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6">
        <OrgNotFound orgEnsName={decodeURIComponent(orgEnsName)} />
      </div>
    );
  }

  return <NewMandateForm org={org} />;
}
