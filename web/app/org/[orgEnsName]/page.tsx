"use client";

import { use, useMemo, useState } from "react";
import { motion } from "motion/react";
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { sepolia, arcTestnet } from "viem/chains";
import { maxUint256, parseUnits, type Address, type Hex } from "viem";
import { AgentTreasuryAbi, Erc20Abi, MandateRegistrarAbi } from "@mandate/shared/abis";
import { fromErc20Usdc } from "@mandate/shared/decimals";
import { Drawer } from "@mandate/ui/components/Drawer";
import { Display, Eyebrow, Lede, RuleLabel } from "@mandate/ui/components/Type";
import { Stat } from "@mandate/ui/components/Stat";
import { Card } from "@mandate/ui/components/Card";
import { Button } from "@mandate/ui/components/Button";
import { Input } from "@mandate/ui/components/Field";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { SkeletonRows } from "@mandate/ui/components/Skeleton";
import { fadeUp } from "@mandate/ui/lib/motion";
import type { OrgWithVault } from "@mandate/shared/orgs";
import { getPublicArcAddresses } from "@/lib/publicNetworkAddresses";
import { useSelectedOrg } from "@/lib/useSelectedOrg";
import { mandateStateOf, useMandateGraph } from "@/lib/useMandateGraph";
import { useMandateLabels } from "@/lib/useMandateLabels";
import { usePaymentsFeed } from "@/lib/usePaymentsFeed";
import { formatTxError } from "@/lib/txError";
import { useAdversaryAttempts } from "@/lib/useAdversaryAttempts";
import { useIsOrgAdmin } from "@/lib/useIsOrgAdmin";
import { MandateTree } from "@/app/_components/MandateTree";
import { MandateDetailPanel } from "@/app/_components/MandateDetailPanel";
import { OrgNotFound } from "@/app/_components/OrgNotFound";

const SHOW_ADVANCED = process.env.NEXT_PUBLIC_SHOW_ADVANCED === "true";
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * The org's own operations view — everything that used to live at `/` before orgs existed.
 * Addresses come from `org` (the factory's own events, or the single-org fallback resolved
 * on-chain), never from a global env constant: two org tabs open side by side must never read
 * each other's registrar.
 */
/**
 * The adversary agent's own escape-attempts log, surfaced directly — see
 * `web/app/api/adversary/attempts/route.ts`'s NatSpec for what this is and isn't. Renders nothing
 * when the log isn't reachable (a deployment with no adversary process running at all, e.g.
 * production), rather than a misleading "0 attempts" that could read as "0 vulnerabilities."
 */
function AdversaryPanel() {
  const { data, loading } = useAdversaryAttempts();
  if (loading || !data?.available || data.total === 0) return null;

  const clean = data.succeeded === 0;
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" transition={{ delay: 0.09 }} className="mt-6">
      <Card padding="lg">
        <div className="flex items-center justify-between gap-6">
          <div className="grid grid-cols-3 gap-8">
            <Stat label="Escape attempts" value={data.total} />
            <Stat label="Succeeded" value={data.succeeded} />
            <Stat label="Blocked" value={data.blocked} />
          </div>
          <span className={`shrink-0 font-mono text-[11px] uppercase tracking-label ${clean ? "text-live" : "text-revoked"}`}>
            {clean ? "none succeeded" : "review needed"}
          </span>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-tertiary">
          A red-team agent attacking its own mandate — an exploratory fuzz over paths a human
          wouldn&rsquo;t think to try, not a formal proof. The Foundry invariant suite is the actual
          proof; this is a demonstration.
        </p>
      </Card>
    </motion.div>
  );
}

/**
 * Treasury balance + a Fund control, folded onto the dashboard so there's no separate page to
 * visit just to see how much the org's agents can draw against. Funding is `approve` (max, once)
 * then `deposit` on Arc — the org admin's own USDC.
 */
function TreasuryStrip({ treasury, isAdmin }: { treasury: Address; isAdmin: boolean }) {
  const arcAddrs = getPublicArcAddresses();
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const arcClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync } = useWriteContract();
  const [mode, setMode] = useState<"fund" | "withdraw" | null>(null);
  const [amount, setAmount] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // The literal USDC balance sitting in the contract right now — not `totalDeposited`, which is a
  // lifetime-deposits counter that a withdrawal (or a spend) never decrements. This is the number
  // "Withdraw" and "Fund" actually change, and the only one that answers "how much is in there?".
  const { data: available, refetch: refetchAvailable } = useReadContract({
    address: arcAddrs.usdc,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: [treasury],
    chainId: arcTestnet.id,
  });
  const { data: drawn, refetch: refetchDrawn } = useReadContract({
    address: treasury,
    abi: AgentTreasuryAbi,
    functionName: "totalDrawn",
    chainId: arcTestnet.id,
  });

  function openMode(next: "fund" | "withdraw") {
    setError(undefined);
    setAmount("");
    if (next === "withdraw" && address) setWithdrawTo(address);
    setMode((m) => (m === next ? null : next));
  }

  async function fund() {
    setError(undefined);
    if (!arcClient || !address) return;
    const value = parseUnits(amount || "0", 6);
    if (value <= 0n) {
      setError("Enter an amount.");
      return;
    }
    setBusy(true);
    try {
      if (chainId !== arcTestnet.id) await switchChainAsync({ chainId: arcTestnet.id });

      const allowance = await arcClient.readContract({
        address: arcAddrs.usdc,
        abi: Erc20Abi,
        functionName: "allowance",
        args: [address, treasury],
      });
      if (allowance < value) {
        const approveHash = await writeContractAsync({
          address: arcAddrs.usdc,
          abi: Erc20Abi,
          functionName: "approve",
          args: [treasury, maxUint256],
          chainId: arcTestnet.id,
        });
        await arcClient.waitForTransactionReceipt({ hash: approveHash });
      }
      const depHash = await writeContractAsync({
        address: treasury,
        abi: AgentTreasuryAbi,
        functionName: "deposit",
        args: [value],
        chainId: arcTestnet.id,
      });
      await arcClient.waitForTransactionReceipt({ hash: depHash });
      setAmount("");
      setMode(null);
      refetchAvailable();
    } catch (err) {
      setError(formatTxError(err));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setError(undefined);
    if (!arcClient) return;
    const value = parseUnits(amount || "0", 6);
    if (value <= 0n) {
      setError("Enter an amount.");
      return;
    }
    if (!ADDRESS_RE.test(withdrawTo)) {
      setError("Enter a valid recipient address.");
      return;
    }
    setBusy(true);
    try {
      if (chainId !== arcTestnet.id) await switchChainAsync({ chainId: arcTestnet.id });
      const hash = await writeContractAsync({
        address: treasury,
        abi: AgentTreasuryAbi,
        functionName: "withdraw",
        args: [withdrawTo as Address, value],
        chainId: arcTestnet.id,
      });
      await arcClient.waitForTransactionReceipt({ hash });
      setAmount("");
      setMode(null);
      refetchAvailable();
      refetchDrawn();
    } catch (err) {
      setError(formatTxError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="grid grid-cols-2 gap-8">
          <Stat label="Available" value={fromErc20Usdc(available ?? 0n)} unit="USDC" />
          <Stat label="Drawn" value={fromErc20Usdc(drawn ?? 0n)} unit="USDC" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => openMode("fund")}>
            {mode === "fund" ? "Cancel" : "Fund"}
          </Button>
          {isAdmin ? (
            <Button variant="secondary" size="sm" onClick={() => openMode("withdraw")}>
              {mode === "withdraw" ? "Cancel" : "Withdraw"}
            </Button>
          ) : null}
        </div>
      </div>
      {mode === "fund" ? (
        <div className="mt-4 flex items-end gap-3">
          <Input mono type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
          <Button size="sm" onClick={fund} disabled={busy}>
            {busy ? "Funding…" : "Deposit USDC"}
          </Button>
        </div>
      ) : mode === "withdraw" ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-label text-tertiary">To</label>
            <Input mono value={withdrawTo} onChange={(e) => setWithdrawTo(e.target.value.trim())} placeholder="0x…" />
          </div>
          <Input mono type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
          <Button size="sm" onClick={withdraw} disabled={busy}>
            {busy ? "Withdrawing…" : "Withdraw USDC"}
          </Button>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-[12px] text-revoked-strong">{error}</p> : null}
    </Card>
  );
}

/** Every agent payment under this org, newest first — where a running agent's spends show up. */
function PaymentsFeed({ treasury }: { treasury: Address }) {
  const { rows, loading } = usePaymentsFeed(treasury);

  return (
    <Card padding="lg">
      <RuleLabel>Agent payments</RuleLabel>
      {loading ? (
        <div className="mt-3">
          <SkeletonRows rows={3} />
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-tertiary">No payments yet. An agent&rsquo;s spends land here live.</p>
      ) : (
        <div className="mt-3 divide-y divide-border-subtle border-t border-border-subtle">
          {rows.slice(0, 20).map((r) => (
            <div key={`${r.txHash}-${r.recipient}`} className="flex items-center justify-between gap-4 py-2.5 text-[13px]">
              <div className="flex items-center gap-2 min-w-0">
                <MonoValue value={r.agent} className="text-tertiary" />
                <span className="text-disabled">→</span>
                <MonoValue value={r.recipient} className="text-secondary" />
              </div>
              <span className="shrink-0 font-mono tnum text-primary">${fromErc20Usdc(r.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function OrgOverview({ org }: { org: OrgWithVault }) {
  const { nodes, loading } = useMandateGraph(org.registrar, org.createdAtBlock);
  const labels = useMandateLabels(
    useMemo(() => nodes.map((n) => n.node), [nodes]),
    org.registrar,
  );
  const { writeContract, isPending } = useWriteContract();
  const { isConnected } = useAccount();
  const { isAdmin } = useIsOrgAdmin(org.registrar);
  const [selected, setSelected] = useState<Hex | null>(null);
  const [revokingNode, setRevokingNode] = useState<Hex | null>(null);
  const now = Math.floor(Date.now() / 1000);

  const counts = useMemo(() => {
    const c = { live: 0, expiring: 0, revoked: 0, stale: 0 };
    for (const n of nodes) c[mandateStateOf(n, now)] += 1;
    return c;
  }, [nodes, now]);

  const selectedNode = selected ? (nodes.find((n) => n.node === selected) ?? null) : null;

  function handleRevoke(node: Hex) {
    setRevokingNode(node);
    writeContract({
      address: org.registrar,
      abi: MandateRegistrarAbi,
      functionName: "revokeMandate",
      args: [node, ("0x" + "0".repeat(64)) as Hex],
      chainId: sepolia.id,
    });
  }

  const detailAddresses = {
    mandateRegistrar: org.registrar,
    mandateAnchor: org.vault?.anchor,
    agentTreasury: org.vault?.treasury,
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <motion.div variants={fadeUp} initial="hidden" animate="visible">
        <Eyebrow>{org.orgEnsName}</Eyebrow>
        <Display as="h1" size="md" className="mt-2">
          Agents
        </Display>
        <Lede className="mt-3">Every mandate under {org.orgEnsName}. Select one to view or revoke it.</Lede>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.06 }}
        className="mt-10 grid gap-4 sm:grid-cols-2"
      >
        <TreasuryStrip treasury={org.vault!.treasury} isAdmin={isAdmin} />
        <Card padding="lg">
          <div className="grid grid-cols-3 gap-6">
            <Stat label="Live" value={counts.live} />
            <Stat label="Revoked" value={counts.revoked} />
            <Stat label="Total" value={nodes.length} />
          </div>
        </Card>
      </motion.div>

      {SHOW_ADVANCED ? <AdversaryPanel /> : null}

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.12 }}
        className="mt-6"
      >
        <Card padding="lg">
          {loading ? (
            <SkeletonRows rows={5} />
          ) : nodes.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[14px] font-medium text-primary">No agents yet</p>
              <p className="mt-2 text-[13px] text-tertiary">
                {isConnected ? "Register one from the sidebar." : "Sign in with the admin wallet to register one."}
              </p>
            </div>
          ) : (
            <MandateTree
              nodes={nodes}
              labels={labels}
              selectedNode={selected ?? undefined}
              onSelect={setSelected}
              orgEnsName={org.orgEnsName}
              registrar={org.registrar}
            />
          )}
        </Card>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.16 }}
        className="mt-6"
      >
        <PaymentsFeed treasury={org.vault!.treasury} />
      </motion.div>

      <Drawer
        open={Boolean(selectedNode)}
        onClose={() => setSelected(null)}
        title={<Eyebrow>Mandate detail</Eyebrow>}
      >
        {selectedNode ? (
          <MandateDetailPanel
            node={selectedNode.node}
            state={mandateStateOf(selectedNode, now)}
            addresses={detailAddresses}
            displayName={
              labels.get(selectedNode.node)
                ? `${labels.get(selectedNode.node)}.${org.orgEnsName}`
                : org.orgEnsName
            }
            registrar={org.registrar}
            isOrgAdmin={isAdmin}
            onRevoke={isAdmin ? () => handleRevoke(selectedNode.node) : undefined}
            revoking={revokingNode === selectedNode.node && isPending}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

export default function OrgOverviewPage({ params }: { params: Promise<{ orgEnsName: string }> }) {
  const { orgEnsName } = use(params);
  const { org, loading, notFound } = useSelectedOrg(decodeURIComponent(orgEnsName));

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
        <SkeletonRows rows={5} />
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

  return <OrgOverview org={org} />;
}
