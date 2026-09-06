"use client";

import { use } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { arcTestnet } from "viem/chains";
import type { Address } from "viem";
import { AgentTreasuryAbi } from "@mandate/shared/abis";
import { fromErc20Usdc } from "@mandate/shared/decimals";
import { Card } from "@mandate/ui/components/Card";
import { MonoValue } from "@mandate/ui/components/MonoValue";
import { Display, Eyebrow, Lede, RuleLabel } from "@mandate/ui/components/Type";
import { Meter, Stat } from "@mandate/ui/components/Stat";
import { Table, TableWrap, Td, Th, Tr } from "@mandate/ui/components/Table";
import { SkeletonRows } from "@mandate/ui/components/Skeleton";
import { useSelectedOrg } from "@/lib/useSelectedOrg";
import { useMandateGraph } from "@/lib/useMandateGraph";
import { OrgNotFound } from "@/app/_components/OrgNotFound";
import { NotDeployed } from "@/app/_components/NotDeployed";

/**
 * Every hook this page needs lives here, called unconditionally — never in the outer
 * `TreasuryPage`, which resolves the org (and may not have a vault yet) before this can mount.
 * See this file's earlier fix: calling hooks after a conditional return is a real Rules-of-Hooks
 * violation, silently safe only as long as the branch never flipped at runtime. Org selection is
 * now a route param, so it does.
 */
function TreasuryView({ treasury, registrar }: { treasury: Address; registrar: Address }) {
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
  const { data: totalWithdrawn } = useReadContract({
    address: treasury,
    abi: AgentTreasuryAbi,
    functionName: "totalWithdrawn",
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

  const { nodes: mandateNodes } = useMandateGraph(registrar);
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

  // `accounts(agent).spentAccum` is the raw leaky-bucket accumulator as of its last write — it
  // over-reports once time has passed since the agent's last spend, because it hasn't decayed yet.
  // `spentNow` is the same value read through `_decayedSpent`, which is what the contract itself
  // actually checks against `budgetTotal` on the next spend — this column must show that, not the
  // stale raw figure, or an agent can look maxed out here while still able to spend freely.
  const { data: spentNowResults } = useReadContracts({
    contracts: agents.map((agent) => ({
      address: treasury,
      abi: AgentTreasuryAbi,
      functionName: "spentNow" as const,
      args: [agent] as const,
      chainId: arcTestnet.id,
    })),
    query: { enabled: agents.length > 0, refetchInterval: 15_000 },
  });

  // v2's cap base is (totalDeposited - totalWithdrawn), not totalDeposited alone — liquidity the
  // org already withdrew is no longer backing anything. Mirrored here so this tile never disagrees
  // with what the contract itself will actually enforce on the next spend.
  const liquidBase = (totalDeposited ?? 0n) - (totalWithdrawn ?? 0n);
  const utilisationFraction =
    liquidBase > 0n ? Number(((totalDrawn ?? 0n) * 10_000n) / liquidBase) / 10_000 : 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <Eyebrow>Money plane · Arc testnet</Eyebrow>
      <Display as="h1" size="sm" className="mt-2">
        Treasury
      </Display>
      <Lede className="mt-3">
        The org&rsquo;s revolving USDC credit facility on Arc — drawn against available, per-agent
        utilisation, interest accruing simple, not compounding.
      </Lede>

      <Card padding="lg" className="mt-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-5">
          <Stat label="Deposited" value={fromErc20Usdc(totalDeposited ?? 0n)} unit="USDC" />
          <Stat label="Drawn" value={fromErc20Usdc(totalDrawn ?? 0n)} unit="USDC" />
          <Stat label="Utilisation" value={(utilisationFraction * 100).toFixed(1)} unit="%" />
          <Stat label="Cap" value={((utilisationCapBps ?? 0) as number) / 100} unit="%" />
          <Stat label="Interest" value={((interestRateBps ?? 0) as number) / 100} unit="% APY" />
        </div>
        <Meter value={utilisationFraction} state={utilisationFraction > 0.9 ? "expiring" : "live"} className="mt-6" />
      </Card>

      <div className="mt-10">
        <RuleLabel>Per-agent</RuleLabel>
        <Card padding="lg" className="mt-4">
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Agent</Th>
                  <Th>Spent (this window)</Th>
                  <Th>Principal owed</Th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, i) => {
                  const account = accounts?.[i]?.result as readonly [bigint, bigint, bigint, bigint] | undefined;
                  const spentNow = spentNowResults?.[i]?.result as bigint | undefined;
                  return (
                    <Tr key={agent}>
                      <Td>
                        <MonoValue value={agent} className="text-secondary" />
                      </Td>
                      <Td className="tnum text-secondary">
                        {spentNow !== undefined ? `$${fromErc20Usdc(spentNow)}` : "—"}
                      </Td>
                      <Td className="tnum text-secondary">
                        {account ? `$${fromErc20Usdc(account[1])}` : "—"}
                      </Td>
                    </Tr>
                  );
                })}
                {agents.length === 0 && (
                  <tr>
                    <Td colSpan={3} className="text-center text-tertiary">
                      No agents with an issued mandate yet.
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>
    </div>
  );
}

export default function TreasuryPage({ params }: { params: Promise<{ orgEnsName: string }> }) {
  const { orgEnsName } = use(params);
  const { org, loading, notFound } = useSelectedOrg(decodeURIComponent(orgEnsName));

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <SkeletonRows rows={4} />
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

  if (!org.vault) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <NotDeployed what={`${org.orgEnsName}'s Arc vault`} />
      </div>
    );
  }

  return <TreasuryView treasury={org.vault.treasury} registrar={org.registrar} />;
}
