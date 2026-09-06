"use client";

import { use, useState } from "react";
import { Card, CardHeader } from "@mandate/ui/components/Card";
import { Display, Eyebrow, Lede } from "@mandate/ui/components/Type";
import { Field } from "@mandate/ui/components/Field";
import { Button } from "@mandate/ui/components/Button";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { SkeletonRows } from "@mandate/ui/components/Skeleton";
import { useSelectedOrg } from "@/lib/useSelectedOrg";
import { useOptionalPrivy } from "@/lib/usePrivyMandateStatus";
import { useApprovals, type ApprovalAction } from "@/lib/useApprovals";
import { OrgNotFound } from "@/app/_components/OrgNotFound";

const CONTROL =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-[13.5px] font-mono text-primary " +
  "placeholder:text-disabled focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25";

/**
 * Generates a P-256 keypair in the browser via WebCrypto — the private key never leaves this tab
 * except when the signer explicitly pastes it into a "Sign" action below, and even then it's used
 * once server-side and discarded (see `web/lib/approvals.ts`). This is the affordance that makes
 * the tier system usable without asking every operator to already own an authorization keypair.
 */
async function generateKeyPair() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const [pub, priv] = await Promise.all([
    crypto.subtle.exportKey("spki", pair.publicKey),
    crypto.subtle.exportKey("pkcs8", pair.privateKey),
  ]);
  return {
    publicKeyBase64: btoa(String.fromCharCode(...new Uint8Array(pub))),
    privateKeyBase64: btoa(String.fromCharCode(...new Uint8Array(priv))),
  };
}

function TierBuilder() {
  const [displayName, setDisplayName] = useState("");
  const [threshold, setThreshold] = useState(1);
  const [generated, setGenerated] = useState<{ publicKeyBase64: string; privateKeyBase64: string } | null>(
    null,
  );
  const [quorumId, setQuorumId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const privy = useOptionalPrivy();

  async function handleGenerate() {
    setGenerated(await generateKeyPair());
    setQuorumId(null);
  }

  async function handleCreate() {
    if (!generated || !privy?.getAccessToken) return;
    setBusy(true);
    setError(null);
    try {
      const token = await privy.getAccessToken();
      const res = await fetch("/api/privy/key-quorums", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, threshold, publicKeys: [generated.publicKeyBase64] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create tier.");
      setQuorumId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <Eyebrow>Step 1</Eyebrow>
          <p className="mt-1 text-[14px] font-medium text-primary">Create an approval tier</p>
        </div>
      </CardHeader>
      <div className="flex flex-col gap-4">
        <Field label="Tier name" htmlFor="tier-name">
          <input
            id="tier-name"
            className={CONTROL}
            placeholder="finance"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field label="Signers required" hint="This demo starts every tier at 1-of-1; add more signers' public keys to the quorum later via Privy's own dashboard for an m-of-n tier." htmlFor="tier-threshold">
          <input
            id="tier-threshold"
            type="number"
            min={1}
            className={CONTROL}
            value={threshold}
            onChange={(e) => setThreshold(Math.max(1, Number(e.target.value)))}
          />
        </Field>

        {!generated ? (
          <Button variant="secondary" onClick={handleGenerate}>
            Generate a signer keypair
          </Button>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-2 p-4">
            <p className="text-[12px] text-tertiary">
              Save the private key now — it is never stored anywhere and this is the only time it is
              shown. Anyone with it can sign approvals for this tier.
            </p>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-label text-tertiary">Public key</p>
              <MonoValue value={generated.publicKeyBase64} truncate={16} className="break-all" />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-label text-tertiary">Private key</p>
              <MonoValue value={generated.privateKeyBase64} truncate={16} className="break-all text-revoked" />
            </div>
            {!quorumId ? (
              <Button onClick={handleCreate} disabled={!displayName || busy}>
                {busy ? "Creating…" : "Create tier"}
              </Button>
            ) : (
              <p className="font-mono text-[12px] text-live">
                Tier created: <MonoValue value={quorumId} truncate={8} />
              </p>
            )}
          </div>
        )}
        {error ? <p className="text-[13px] text-revoked">{error}</p> : null}
      </div>
    </Card>
  );
}

function ProposeAction({ orgEnsName }: { orgEnsName: string }) {
  const { propose } = useApprovals(orgEnsName);
  const [quorumId, setQuorumId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handlePropose() {
    setBusy(true);
    setStatus(null);
    const action: ApprovalAction = { kind: "updateWalletDisplayName", walletId, displayName };
    try {
      await propose(quorumId, action);
      setStatus("Proposed — see it below, waiting on signatures.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <Eyebrow>Step 2</Eyebrow>
          <p className="mt-1 text-[14px] font-medium text-primary">Propose a tier-gated action</p>
        </div>
      </CardHeader>
      <p className="mb-4 text-[13px] text-tertiary">
        This demo action renames a quorum-owned agent wallet — small and reversible, but it must go
        through the same tier once the wallet has an owner. Attach a wallet to this tier first via{" "}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">
          PATCH /api/privy/wallets/[id]
        </code>
        .
      </p>
      <div className="flex flex-col gap-4">
        <Field label="Tier (key quorum id)" htmlFor="pa-quorum">
          <input id="pa-quorum" className={CONTROL} value={quorumId} onChange={(e) => setQuorumId(e.target.value)} />
        </Field>
        <Field label="Wallet id" htmlFor="pa-wallet">
          <input id="pa-wallet" className={CONTROL} value={walletId} onChange={(e) => setWalletId(e.target.value)} />
        </Field>
        <Field label="New display name" htmlFor="pa-name">
          <input id="pa-name" className={CONTROL} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        <Button onClick={handlePropose} disabled={!quorumId || !walletId || !displayName || busy}>
          {busy ? "Proposing…" : "Propose"}
        </Button>
        {status ? <p className="text-[13px] text-tertiary">{status}</p> : null}
      </div>
    </Card>
  );
}

function PendingApprovals({ orgEnsName }: { orgEnsName: string }) {
  const { approvals, loading, sign } = useApprovals(orgEnsName);
  const [signingId, setSigningId] = useState<string | null>(null);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSign(id: string) {
    const key = keyDrafts[id];
    if (!key) return;
    setSigningId(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      await sign(id, key);
      setKeyDrafts((d) => ({ ...d, [id]: "" }));
    } catch (err) {
      setErrors((e) => ({ ...e, [id]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setSigningId(null);
    }
  }

  return (
    <Card padding="lg">
      <CardHeader>
        <div>
          <Eyebrow>Step 3</Eyebrow>
          <p className="mt-1 text-[14px] font-medium text-primary">Sign off</p>
        </div>
      </CardHeader>
      {loading ? (
        <SkeletonRows rows={3} />
      ) : approvals.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-tertiary">No pending approvals.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border-subtle">
          {approvals.map((a) => (
            <div key={a.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13.5px] text-primary">
                    {a.action.kind === "updateWalletDisplayName"
                      ? `Rename wallet ${a.action.walletId} → "${a.action.displayName}"`
                      : a.action.kind === "updateWalletPolicy"
                        ? `Attach policy to wallet ${a.action.walletId}`
                        : `Detach owner from wallet ${a.action.walletId}`}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-tertiary">
                    {a.signatureCount}/{a.threshold} signed ·{" "}
                    <span
                      className={
                        a.status === "executed"
                          ? "text-live"
                          : a.status === "failed"
                            ? "text-revoked"
                            : "text-expiring"
                      }
                    >
                      {a.status}
                    </span>
                  </p>
                </div>
              </div>
              {a.status === "pending" ? (
                <div className="flex gap-2">
                  <input
                    className={CONTROL}
                    placeholder="Your signer private key (base64, never stored)"
                    value={keyDrafts[a.id] ?? ""}
                    onChange={(e) => setKeyDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSign(a.id)}
                    disabled={signingId === a.id || !keyDrafts[a.id]}
                  >
                    {signingId === a.id ? "Signing…" : "Sign"}
                  </Button>
                </div>
              ) : null}
              {a.error ? <p className="text-[12px] text-revoked">{a.error}</p> : null}
              {errors[a.id] ? <p className="text-[12px] text-revoked">{errors[a.id]}</p> : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ApprovalsView({ orgEnsName }: { orgEnsName: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <Eyebrow>Approvals · Privy key quorums</Eyebrow>
      <Display as="h1" size="sm" className="mt-2">
        Tiered sign-off
      </Display>
      <Lede className="mt-3">
        A tier is a Privy key quorum — an m-of-n set of signers. Attach an agent wallet to a tier
        via its <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12px]">owner_id</code>,
        and every subsequent change to it collects signatures here until the threshold is met, then
        executes automatically.
      </Lede>
      <div className="mt-8 flex flex-col gap-6">
        <TierBuilder />
        <ProposeAction orgEnsName={orgEnsName} />
        <PendingApprovals orgEnsName={orgEnsName} />
      </div>
    </div>
  );
}

export default function ApprovalsPage({ params }: { params: Promise<{ orgEnsName: string }> }) {
  const { orgEnsName } = use(params);
  const decoded = decodeURIComponent(orgEnsName);
  const { org, loading, notFound } = useSelectedOrg(decoded);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <SkeletonRows rows={5} />
      </div>
    );
  }
  if (notFound || !org) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-6">
        <OrgNotFound orgEnsName={decoded} />
      </div>
    );
  }
  return <ApprovalsView orgEnsName={decoded} />;
}
