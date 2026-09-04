"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { sepolia } from "viem/chains";
import { parseUnits, type Address, type Hex } from "viem";
import { MandateRegistrarAbi } from "@mandate/shared/abis";
import { buildAllowlist } from "@mandate/shared/merkle";
import { Button } from "@mandate/ui/components/Button";
import { Card } from "@mandate/ui/components/Card";
import { getDeployedAddresses, isDeployed } from "../../../lib/addresses";
import { NotDeployed } from "../../_components/NotDeployed";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-secondary">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-tertiary">{hint}</span>}
    </label>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-primary placeholder:text-disabled focus:border-accent";

export default function NewMandatePage() {
  const addresses = getDeployedAddresses();
  const router = useRouter();

  const [label, setLabel] = useState("");
  const [agentWallet, setAgentWallet] = useState("");
  const [arcWallet, setArcWallet] = useState("");
  const [budgetTotal, setBudgetTotal] = useState("500");
  const [perTxCap, setPerTxCap] = useState("50");
  const [budgetPeriodDays, setBudgetPeriodDays] = useState("1");
  const [expiryDays, setExpiryDays] = useState("7");
  const [maxDepth, setMaxDepth] = useState("2");
  const [allowlist, setAllowlist] = useState("");

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: sepolia.id,
  });

  if (!isDeployed(addresses)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <NotDeployed what="MandateRegistrar" />
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const recipients = allowlist
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter((s) => /^0x[0-9a-fA-F]{40}$/.test(s)) as Address[];

    if (recipients.length === 0) {
      window.alert("Add at least one allowlisted recipient address.");
      return;
    }
    const tree = buildAllowlist(recipients);
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
      address: addresses.mandateRegistrar!,
      abi: MandateRegistrarAbi,
      functionName: "issueMandate",
      args: [label, agentWallet as Address, terms, arcWallet as Address, allowHumanJson],
      chainId: sepolia.id,
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-xl font-medium text-primary">Issue a mandate</h1>
      <p className="mt-2 text-sm text-secondary">
        Writes on-chain, live — this is how the demo proves no hard-coded values.
      </p>

      <Card className="mt-8 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Label" hint="The subname, e.g. 'research' for research.acme.eth">
            <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="research" required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Agent wallet" hint="ENS-side owner">
              <input className={inputClass} value={agentWallet} onChange={(e) => setAgentWallet(e.target.value)} placeholder="0x…" required />
            </Field>
            <Field label="Arc wallet" hint="Spending key on Arc">
              <input className={inputClass} value={arcWallet} onChange={(e) => setArcWallet(e.target.value)} placeholder="0x…" required />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Budget total (USDC)">
              <input className={inputClass} type="number" min="0" value={budgetTotal} onChange={(e) => setBudgetTotal(e.target.value)} />
            </Field>
            <Field label="Per-tx cap (USDC)">
              <input className={inputClass} type="number" min="0" value={perTxCap} onChange={(e) => setPerTxCap(e.target.value)} />
            </Field>
            <Field label="Budget period (days)" hint="0 = lifetime">
              <input className={inputClass} type="number" min="0" value={budgetPeriodDays} onChange={(e) => setBudgetPeriodDays(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Expires in (days)">
              <input className={inputClass} type="number" min="1" value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} />
            </Field>
            <Field label="Sub-delegation depth">
              <input className={inputClass} type="number" min="0" value={maxDepth} onChange={(e) => setMaxDepth(e.target.value)} />
            </Field>
          </div>
          <Field label="Allowlisted recipients" hint="One address per line — becomes the merkle allowlist root">
            <textarea
              className={`${inputClass} h-24 font-mono`}
              value={allowlist}
              onChange={(e) => setAllowlist(e.target.value)}
              placeholder={"0x0747EEf0706327138c69792bF28Cd525089e4583"}
            />
          </Field>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isPending || confirming}>
              {isPending ? "Confirm in wallet…" : confirming ? "Minting…" : "Issue mandate"}
            </Button>
            {confirmed && (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="text-[13px] text-accent hover:underline"
              >
                View on the graph →
              </button>
            )}
          </div>
          {error && <p className="text-[13px] text-revoked">{error.message}</p>}
        </form>
      </Card>
    </div>
  );
}
