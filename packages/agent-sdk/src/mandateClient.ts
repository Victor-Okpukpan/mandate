import { encodeFunctionData, type Address, type Hex } from "viem";
import { AgentTreasuryAbi, PermissionedResolverAbi } from "./abis/index.js";
import { getArcAddresses } from "./addresses.js";
import { buildAllowlist } from "./merkle.js";
import { toErc20Usdc, fromErc20Usdc } from "./decimals.js";
import { parseAllowHuman } from "./allowHuman.js";
import { makeChainClients, readMandateByEnsName } from "./chainClients.js";
import type { AgentSigner } from "./signer.js";

export interface MandateTerms {
  budgetTotal: string;
  perTxCap: string;
  budgetPeriodSeconds: number;
  maxDepth: number;
  expiry: bigint;
  allowedRecipients: Address[];
  revoked: boolean;
}

export interface MandateClient {
  ensName: string;
  signer: AgentSigner;
  /** Live from ENS, every call — never cache this into a system prompt or config. An agent that's
   *  told its budget is following instructions; one that reads it is a namespace citizen. */
  readMyMandate(): Promise<MandateTerms>;
  /** Pays a counterparty directly from the org's Arc treasury. This is the real spend path — it
   *  reverts on-chain if it violates the mandate. Nothing here pre-checks; the contract is the
   *  actual enforcement, and demoing a client-side pre-check would be demoing TypeScript, not the
   *  system. */
  pay(to: Address, amountUsdc: string): Promise<Hex>;
  checkTreasury(): Promise<{ spentThisWindow: string; principalOwed: string }>;
  setStatus(status: "idle" | "working" | "blocked"): Promise<Hex>;
}

/**
 * The one call most integrations need: resolve an agent's own mandate by its ENS name and get
 * back a small, framework-agnostic object. Call `.pay()`/`.readMyMandate()` from a LangChain tool,
 * a raw OpenAI function-calling loop, a cron job — whatever already runs your agent. This has no
 * opinion about what's calling it and no LLM dependency at all.
 *
 * For Anthropic's Tool Runner specifically, `mandate-agent-sdk/anthropic` wraps these same calls
 * in the right tool schema instead of you writing that glue by hand.
 */
export function connectMandate(params: {
  ensName: string;
  signer: AgentSigner;
  clients?: ReturnType<typeof makeChainClients>;
}): MandateClient {
  const clients = params.clients ?? makeChainClients();
  const { ensName, signer } = params;

  async function resolve() {
    return readMandateByEnsName(clients, ensName);
  }

  async function allowedRecipients(node: Hex, resolver: Address): Promise<Address[]> {
    const allowHuman = await clients.sepolia.readContract({
      address: resolver,
      abi: PermissionedResolverAbi,
      functionName: "text",
      args: [node, "mandate.allow.human"],
    });
    return parseAllowHuman(allowHuman);
  }

  return {
    ensName,
    signer,
    async readMyMandate() {
      const { node, mandate } = await resolve();
      const recipients = await allowedRecipients(node, mandate.resolver);
      return {
        budgetTotal: fromErc20Usdc(mandate.terms.budgetTotal),
        perTxCap: fromErc20Usdc(mandate.terms.perTxCap),
        budgetPeriodSeconds: mandate.terms.budgetPeriod,
        maxDepth: mandate.terms.maxDepth,
        expiry: mandate.terms.expiry,
        allowedRecipients: recipients,
        revoked: mandate.revoked,
      };
    },
    async pay(to, amountUsdc) {
      const arc = getArcAddresses();
      if (!arc.agentTreasury) throw new Error("ARC_AGENT_TREASURY not set");
      const { node, mandate } = await resolve();
      const recipients = await allowedRecipients(node, mandate.resolver);
      // A non-allowlisted recipient gets an empty proof and lets the treasury reject it — the
      // point of that path is watching the chain refuse it, not pre-empting the attempt.
      const proof = recipients.includes(to) ? buildAllowlist(recipients).proofFor(to) : [];
      const data = encodeFunctionData({
        abi: AgentTreasuryAbi,
        functionName: "payTo",
        args: [to, toErc20Usdc(amountUsdc), proof],
      });
      return signer.sendTransaction("arc", { to: arc.agentTreasury, data });
    },
    async checkTreasury() {
      const arc = getArcAddresses();
      if (!arc.agentTreasury) throw new Error("ARC_AGENT_TREASURY not set");
      const [spentAccum, principal] = await clients.arc.readContract({
        address: arc.agentTreasury,
        abi: AgentTreasuryAbi,
        functionName: "accounts",
        args: [signer.address],
      });
      return { spentThisWindow: fromErc20Usdc(spentAccum), principalOwed: fromErc20Usdc(principal) };
    },
    async setStatus(status) {
      const { node, mandate } = await resolve();
      const data = encodeFunctionData({
        abi: PermissionedResolverAbi,
        functionName: "setText",
        args: [node, "agent.status", status],
      });
      return signer.sendTransaction("sepolia", { to: mandate.resolver, data });
    },
  };
}
