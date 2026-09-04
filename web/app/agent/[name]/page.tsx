"use client";

import { use } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { sepolia, arcTestnet } from "viem/chains";
import type { Hex } from "viem";
import { MandateRegistrarAbi, MandateAnchorAbi, AgentTreasuryAbi } from "@mandate/shared/abis";
import { PermissionedResolverAbi } from "../../../lib/permissionedResolverAbi";
import { Card } from "@mandate/ui/components/Card";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { getDeployedAddresses, isDeployed } from "../../../lib/addresses";
import { NotDeployed } from "../../_components/NotDeployed";

const MANDATE_TEXT_KEYS = [
  "mandate.v",
  "mandate.principal",
  "mandate.terms.hash",
  "mandate.expires",
  "mandate.budget.total",
  "mandate.budget.period",
  "mandate.budget.perTx",
  "mandate.allow.root",
  "mandate.depth",
];
const AGENT_TEXT_KEYS = ["agent.status", "agent.heartbeat", "agent.output.last"];

function Column({ title, plane, children }: { title: string; plane: string; children: React.ReactNode }) {
  return (
    <Card className="flex-1 p-5">
      <p className="font-mono text-[11px] uppercase tracking-wide text-tertiary">{plane}</p>
      <h2 className="mt-1 text-[15px] font-medium text-primary">{title}</h2>
      <div className="mt-4 space-y-2.5">{children}</div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2 text-[13px]">
      <span className="shrink-0 text-tertiary">{label}</span>
      <span className="truncate text-right text-secondary">{value}</span>
    </div>
  );
}

export default function AgentTriptychPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const node = name as Hex;
  const addresses = getDeployedAddresses();

  if (!isDeployed(addresses)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <NotDeployed what="MandateRegistrar" />
      </div>
    );
  }

  const { data: mandate } = useReadContract({
    address: addresses.mandateRegistrar!,
    abi: MandateRegistrarAbi,
    functionName: "getMandate",
    args: [node],
    chainId: sepolia.id,
  });

  const resolverAddress = mandate?.resolver;

  const { data: mandateTexts } = useReadContracts({
    contracts: MANDATE_TEXT_KEYS.map((key) => ({
      address: resolverAddress,
      abi: PermissionedResolverAbi,
      functionName: "text" as const,
      args: [node, key] as const,
      chainId: sepolia.id,
    })),
    query: { enabled: Boolean(resolverAddress) },
  });

  const { data: agentTexts } = useReadContracts({
    contracts: AGENT_TEXT_KEYS.map((key) => ({
      address: resolverAddress,
      abi: PermissionedResolverAbi,
      functionName: "text" as const,
      args: [node, key] as const,
      chainId: sepolia.id,
    })),
    query: { enabled: Boolean(resolverAddress) },
  });

  const agentWallet = mandate?.agentWallet;

  const { data: anchor } = useReadContract({
    address: addresses.mandateAnchor!,
    abi: MandateAnchorAbi,
    functionName: "anchors",
    args: agentWallet ? [agentWallet] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(agentWallet) },
  });

  const { data: account } = useReadContract({
    address: addresses.agentTreasury!,
    abi: AgentTreasuryAbi,
    functionName: "accounts",
    args: agentWallet ? [agentWallet] : undefined,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(agentWallet) },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="font-mono text-lg font-medium text-primary">
          <MonoValue value={node} truncate={10} />
        </h1>
        {agentWallet && <MonoValue value={agentWallet} className="text-tertiary" />}
      </div>
      <p className="mt-1 text-sm text-secondary">
        Three views of one fact — the same mandate, read from Sepolia, Privy, and Arc.
      </p>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row">
        <Column title="ENS records" plane="Sepolia">
          {mandateTexts?.map((r, i) => (
            <Row key={MANDATE_TEXT_KEYS[i]} label={MANDATE_TEXT_KEYS[i]!} value={String(r.result ?? "—")} />
          ))}
          <p className="pt-2 text-[10px] uppercase tracking-wide text-tertiary">agent-writable</p>
          {agentTexts?.map((r, i) => (
            <Row key={AGENT_TEXT_KEYS[i]} label={AGENT_TEXT_KEYS[i]!} value={String(r.result || "—")} />
          ))}
        </Column>

        <Column title="Privy policy" plane="Off-chain">
          <p className="text-[13px] leading-relaxed text-tertiary">
            Rendered from the Enforcer&rsquo;s policy-sync API once it&rsquo;s running — the
            conditional policy compiled from this mandate&rsquo;s ENS terms.
          </p>
        </Column>

        <Column title="Arc anchor & ledger" plane="Arc">
          {anchor && (
            <>
              <Row label="revoked" value={anchor[8] ? "true" : "false"} />
              <Row label="updatedAt" value={anchor[6]?.toString()} />
              <Row label="nonce" value={anchor[7]?.toString()} />
            </>
          )}
          {account && (
            <>
              <Row label="spentAccum" value={account[0]?.toString()} />
              <Row label="principal" value={account[1]?.toString()} />
            </>
          )}
          {!anchor && !account && <p className="text-[13px] text-tertiary">No Arc-side state yet.</p>}
        </Column>
      </div>
    </div>
  );
}
