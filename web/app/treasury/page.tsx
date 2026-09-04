"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { arcTestnet } from "viem/chains";
import { AgentTreasuryAbi } from "@mandate/shared/abis";
import { fromErc20Usdc } from "@mandate/shared/decimals";
import { Card } from "@mandate/ui/components/Card";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { getDeployedAddresses, isDeployed } from "../../lib/addresses";
import { useMandateGraph } from "../../lib/useMandateGraph";
import { NotDeployed } from "../_components/NotDeployed";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-tertiary">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums text-primary">{value}</p>
    </div>
  );
}

export default function TreasuryPage() {
  const addresses = getDeployedAddresses();

  if (!isDeployed(addresses)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <NotDeployed what="AgentTreasury" />
      </div>
    );
  }

  const treasury = addresses.agentTreasury!;
  const { data: totalDeposited } = useReadContract({
    address: treasury,
    abi: AgentTreasuryAbi,
    functionName: "totalDeposited",
    chainId: arcTestnet.id,
  });
  const { data: totalDrawn } = useReadContract({
    address: treasury,
    abi: AgentTreasuryAbi,
    functionName: "totalDrawn",
    chainId: arcTestnet.id,
  });
  const { data: utilisationCapBps } = useReadContract({
    address: treasury,
    abi: AgentTreasuryAbi,
    functionName: "utilisationCapBps",
    chainId: arcTestnet.id,
  });
  const { data: interestRateBps } = useReadContract({
    address: treasury,
    abi: AgentTreasuryAbi,
    functionName: "interestRateBps",
    chainId: arcTestnet.id,
  });

  const { nodes: mandateNodes } = useMandateGraph(addresses.mandateRegistrar);
  const agents = Array.from(new Set(mandateNodes.map((n) => n.agentWallet)));

  const { data: accounts } = useReadContracts({
    contracts: agents.map((agent) => ({
      address: treasury,
      abi: AgentTreasuryAbi,
      functionName: "accounts" as const,
      args: [agent] as const,
      chainId: arcTestnet.id,
    })),
    query: { enabled: agents.length > 0 },
  });

  const utilisationPct =
    totalDeposited && totalDeposited > 0n ? Number(((totalDrawn ?? 0n) * 10_000n) / totalDeposited) / 100 : 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-xl font-medium text-primary">Treasury</h1>
      <p className="mt-2 text-sm text-secondary">
        The org&rsquo;s revolving USDC credit facility on Arc — drawn vs. available, per-agent
        utilisation, interest accruing.
      </p>

      <Card className="mt-8 p-6">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Deposited" value={`$${fromErc20Usdc(totalDeposited ?? 0n)}`} />
          <Stat label="Drawn" value={`$${fromErc20Usdc(totalDrawn ?? 0n)}`} />
          <Stat label="Utilisation" value={`${utilisationPct.toFixed(1)}%`} />
          <Stat label="Cap / rate" value={`${((utilisationCapBps ?? 0) as number) / 100}% · ${((interestRateBps ?? 0) as number) / 100}% APY`} />
        </div>
      </Card>

      <h2 className="mt-10 text-[15px] font-medium text-primary">Per-agent</h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="px-4 py-2.5 font-medium text-secondary">Agent</th>
              <th className="px-4 py-2.5 font-medium text-secondary">Spent (this window)</th>
              <th className="px-4 py-2.5 font-medium text-secondary">Principal owed</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent, i) => {
              const account = accounts?.[i]?.result as readonly [bigint, bigint, bigint, bigint] | undefined;
              return (
                <tr key={agent} className="border-b border-border-subtle last:border-0">
                  <td className="px-4 py-2.5">
                    <MonoValue value={agent} className="text-secondary" />
                  </td>
                  <td className="px-4 py-2.5 text-secondary">
                    {account ? `$${fromErc20Usdc(account[0])}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-secondary">
                    {account ? `$${fromErc20Usdc(account[1])}` : "—"}
                  </td>
                </tr>
              );
            })}
            {agents.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-tertiary">
                  No agents with an issued mandate yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
