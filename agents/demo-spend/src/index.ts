import { PrivyClient } from "@privy-io/node";
import { encodeFunctionData, getAddress, namehash, type Address, type Hex } from "viem";
import { AgentTreasuryAbi, PermissionedResolverAbi } from "@mandate/shared/abis";
import { getArcAddresses, getRpcUrls } from "@mandate/shared/addresses";
import { buildAllowlist } from "@mandate/shared/merkle";
import { parseAllowHuman } from "@mandate/shared/allowHuman";
import { toErc20Usdc, fromErc20Usdc } from "@mandate/shared/decimals";
import { makeChainClients, makeDevSigner, makePrivySigner, readMandateByEnsName } from "@mandate/agents-shared";

/**
 * The demo "agent" — no LLM, no reasoning loop. It holds the agent wallet and calls the real
 * `AgentTreasury.payTo` once, exactly the way `agents/shared/src/tools.ts`'s `pay` tool does. Run
 * it three times on demo day:
 *
 *   pnpm spend 5                       → within cap, allowlisted recipient  → lands
 *   pnpm spend 5000                    → over budget                        → reverts
 *   (revoke the mandate in the app, then) pnpm spend 5   → reverts
 *
 * Nothing here checks the mandate before sending — that's the treasury's and the anchor's job, and
 * watching the chain reject a bad payment is the entire point.
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

async function main() {
  const amountUsdc = process.argv[2];
  if (!amountUsdc || Number.isNaN(Number(amountUsdc))) {
    throw new Error("usage: pnpm spend <amountUsdc> [recipientAddress]");
  }
  const ensName = requireEnv("AGENT_ENS_NAME");
  const arc = getArcAddresses();
  if (!arc.agentTreasury) throw new Error("ARC_AGENT_TREASURY not set");

  const clients = makeChainClients();

  const devKey = process.env.AGENT_DEV_PRIVATE_KEY_ANVIL_ONLY;
  const signer = devKey
    ? makeDevSigner(devKey as Hex, getRpcUrls())
    : makePrivySigner(
        new PrivyClient({ appId: requireEnv("PRIVY_APP_ID"), appSecret: requireEnv("PRIVY_APP_SECRET") }),
        requireEnv("AGENT_PRIVY_WALLET_ID"),
        requireEnv("AGENT_ARC_WALLET_ADDRESS") as Address,
        clients.arc,
      );

  // Resolve the agent's own mandate — live, same as read_my_mandate().
  const { node, mandate } = await readMandateByEnsName(clients, ensName);
  const resolver = mandate.resolver;
  const allowHuman = await clients.sepolia.readContract({
    address: resolver,
    abi: PermissionedResolverAbi,
    functionName: "text",
    args: [namehash(ensName), "mandate.allow.human"],
  });
  const recipients = parseAllowHuman(allowHuman).map((r) => getAddress(r));
  const to = process.argv[3] ? getAddress(process.argv[3]) : recipients[0];
  if (!to) throw new Error("No recipient given and the mandate's allowlist is empty.");

  console.log(`\n  agent        ${signer.address}`);
  console.log(`  mandate      ${ensName}  (revoked: ${mandate.revoked})`);
  console.log(`  budget       ${fromErc20Usdc(mandate.terms.budgetTotal)} USDC total`);
  console.log(`  per-tx cap   ${fromErc20Usdc(mandate.terms.perTxCap)} USDC`);
  console.log(`  allowlist    ${recipients.join(", ") || "(none)"}`);
  console.log(`\n  → paying ${amountUsdc} USDC to ${to}${recipients.includes(to) ? "" : "  (NOT allowlisted)"}\n`);

  // A non-allowlisted recipient gets an empty proof — the treasury rejects it, which is the point
  // of that run. `proofFor` would throw here rather than let us send the doomed transaction.
  const proof =
    recipients.length > 0 && recipients.includes(to) ? buildAllowlist(recipients).proofFor(to) : [];
  const data = encodeFunctionData({
    abi: AgentTreasuryAbi,
    functionName: "payTo",
    args: [to, toErc20Usdc(amountUsdc), proof],
  });

  try {
    const hash = await signer.sendTransaction("arc", { to: arc.agentTreasury, data });
    const receipt = await clients.arc.waitForTransactionReceipt({ hash });
    if (receipt.status === "success") {
      console.log(`  ✓ PAID — tx ${hash}\n`);
    } else {
      console.log(`  ✗ REVERTED on-chain — tx ${hash}  (the mandate refused it)\n`);
    }
  } catch (err) {
    console.log(`  ✗ REJECTED — ${err instanceof Error ? err.message.split("\n")[0] : String(err)}\n`);
  }
}

main().catch((err) => {
  console.error("fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
