"use client";

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
import { getDeployedAddresses, isDeployed, type DeployedAddresses } from "../../lib/addresses";
import { useMandateGraph } from "../../lib/useMandateGraph";
import { NotDeployed } from "../_components/NotDeployed";

/**
 * Every hook this page needs lives here, called unconditionally — never in the outer
 * `TreasuryPage`, which has an early return before it can know a treasury exists. Calling hooks
 * after a conditional return is a real Rules-of-Hooks violation; it was silently safe only because
 * `isDeployed` used to read build-inlined env constants that never changed between renders. Once
 * org selection is dynamic (a route param instead of a single env var), that branch flips at
 * runtime and React throws "Rendered fewer hooks than expected." Fix it here, once, rather than at
 * the point something dynamic gets bolted on.
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
                  return (
                    <Tr key={agent}>
                      <Td>
                        <MonoValue value={agent} className="text-secondary" />
                      </Td>
                      <Td className="tnum text-secondary">
                        {account ? `$${fromErc20Usdc(account[0])}` : "—"}
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

export default function TreasuryPage() {
  const addresses: DeployedAddresses = getDeployedAddresses();

  if (!isDeployed(addresses, ["mandateRegistrar", "agentTreasury"])) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <NotDeployed what="AgentTreasury" />
      </div>
    );
  }

  return <TreasuryView treasury={addresses.agentTreasury!} registrar={addresses.mandateRegistrar!} />;
}
