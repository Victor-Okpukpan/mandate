"use client";

import { useEffect, useMemo, useState } from "react";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { sepolia } from "viem/chains";
import { parseUnits, type Address } from "viem";
import { MandateRegistrarAbi } from "@mandate/shared/abis";
import { buildAllowlist } from "@mandate/shared/merkle";
import type { OrgWithVault } from "@mandate/shared/orgs";
import { Button } from "@mandate/ui/components/Button";
import { Field, Input, Textarea } from "@mandate/ui/components/Field";
import { useOptionalPrivy } from "@/lib/usePrivyMandateStatus";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const LABEL_RE = /^[a-z0-9-]{1,63}$/;

/**
 * The whole agent-registration surface: name, budget, cap, expiry, allowlist. The Privy wallet is
 * provisioned automatically on submit — no button, no address field. "Advanced" holds the two
 * knobs almost nobody touches (budget period, sub-delegation depth) at sane defaults. Used both as
 * the last step of the onboarding wizard and as a standalone screen from the dashboard.
 */
export function RegisterAgentForm({
  org,
  submitLabel = "Register agent",
  onDone,
}: {
  org: OrgWithVault;
  submitLabel?: string;
  onDone: (label: string) => void;
}) {
  const privy = useOptionalPrivy();

  const [label, setLabel] = useState("");
  const [budgetTotal, setBudgetTotal] = useState("500");
  const [perTxCap, setPerTxCap] = useState("50");
  const [expiryDays, setExpiryDays] = useState("7");
  const [allowlist, setAllowlist] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [budgetPeriodDays, setBudgetPeriodDays] = useState("0");
  const [maxDepth, setMaxDepth] = useState("0");

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();

  const { writeContractAsync, data: txHash } = useWriteContract();
  const { isSuccess: confirmed } = useWaitForTransactionReceipt({ hash: txHash, chainId: sepolia.id });

  useEffect(() => {
    if (confirmed) onDone(label);
  }, [confirmed, label, onDone]);

  const recipients = useMemo(
    () =>
      allowlist
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [allowlist],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(undefined);

    if (!LABEL_RE.test(label)) {
      setFormError("Agent name: lowercase letters, digits, hyphens.");
      return;
    }
    const invalid = recipients.filter((r) => !ADDRESS_RE.test(r));
    if (recipients.length === 0) {
      setFormError("Add at least one address the agent may pay.");
      return;
    }
    if (invalid.length > 0) {
      setFormError(`Not a valid address: ${invalid[0]}`);
      return;
    }

    setBusy(true);
    try {
      if (!privy) throw new Error("Privy isn't configured on this deployment.");
      const token = await privy.getAccessToken();
      if (!token) throw new Error("Sign in first.");
      const res = await fetch("/api/agents/provision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Wallet provisioning failed (${res.status})`);
      const wallet = body.address as Address;

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

      await writeContractAsync({
        address: org.registrar,
        abi: MandateRegistrarAbi,
        functionName: "issueMandate",
        args: [label, wallet, terms, wallet, allowHumanJson],
        chainId: sepolia.id,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field label="Agent name" required hint={`Becomes ${label || "name"}.${org.orgEnsName}`}>
        <Input value={label} onChange={(e) => setLabel(e.target.value.toLowerCase())} placeholder="researcher" required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Budget" hint="USDC, total">
          <Input mono type="number" min="0" value={budgetTotal} onChange={(e) => setBudgetTotal(e.target.value)} />
        </Field>
        <Field label="Per-payment cap" hint="USDC">
          <Input mono type="number" min="0" value={perTxCap} onChange={(e) => setPerTxCap(e.target.value)} />
        </Field>
      </div>

      <Field label="Expires in" hint="Days">
        <Input mono type="number" min="1" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} />
      </Field>

      <Field label="Allowed addresses" required hint="One per line. The agent can pay these and nobody else.">
        <Textarea
          mono
          value={allowlist}
          onChange={(e) => setAllowlist(e.target.value)}
          placeholder="0x0747EEf0706327138c69792bF28Cd525089e4583"
        />
      </Field>

      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-[12px] text-tertiary hover:text-secondary"
        >
          {showAdvanced ? "− Advanced" : "+ Advanced"}
        </button>
        {showAdvanced ? (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Field label="Budget period" hint="Days · 0 = lifetime">
              <Input
                mono
                type="number"
                min="0"
                value={budgetPeriodDays}
                onChange={(e) => setBudgetPeriodDays(e.target.value)}
              />
            </Field>
            <Field label="Sub-delegation depth" hint="0 = cannot delegate">
              <Input mono type="number" min="0" value={maxDepth} onChange={(e) => setMaxDepth(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </div>

      <div className="pt-1">
        <Button type="submit" disabled={busy}>
          {busy ? "Registering…" : submitLabel}
        </Button>
        {formError ? <p className="mt-2 text-[12px] text-revoked-strong">{formError}</p> : null}
      </div>
    </form>
  );
}
