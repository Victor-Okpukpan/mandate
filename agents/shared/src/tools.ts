import { z } from "zod/v4";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { encodeFunctionData, namehash, type Address } from "viem";
import {
  MandateRegistrarAbi,
  AgentTreasuryAbi,
  PermissionedResolverAbi,
  JobsAbi,
} from "@mandate/shared/abis";
import { getArcAddresses, getSepoliaAddresses } from "@mandate/shared/addresses";
import { buildAllowlist } from "@mandate/shared/merkle";
import { toErc20Usdc, fromErc20Usdc } from "@mandate/shared/decimals";
import { parseAllowHuman } from "@mandate/shared/allowHuman";
import { readArcAnchor, readMandateByEnsName, type makeChainClients } from "./chainClients.js";
import type { AgentSigner } from "./signer.js";

/**
 * The tool surface every mandated agent gets — research, scraper, vendor alike, per mandate.md
 * §12.2. Two rules that decide whether this is real or theatre, both held to throughout:
 *
 * 1. **Never put the budget in the system prompt.** `ensName` here is configuration — which
 *    mandate is this agent's own — not what that mandate currently allows. Every number a tool
 *    returns is read live from Sepolia or Arc, on every call, never cached into a prompt.
 * 2. **Do not pre-filter in the tool layer.** `pay`, `createJob`, `issueSubmandate` and friends
 *    call the real contract directly and let it revert. No tool here checks "is this within
 *    budget" before sending the transaction — that's `AgentTreasury`'s and `MandateAnchor`'s job,
 *    and demoing our own pre-check would be demoing TypeScript, not the enforcement.
 */
export interface ToolContext {
  ensName: string;
  clients: ReturnType<typeof makeChainClients>;
  signer: AgentSigner;
}

function requireAddresses() {
  const sepoliaAddrs = getSepoliaAddresses();
  const arcAddrs = getArcAddresses();
  if (!sepoliaAddrs.mandateRegistrar) throw new Error("SEPOLIA_MANDATE_REGISTRAR not set");
  if (!arcAddrs.mandateAnchor || !arcAddrs.agentTreasury || !arcAddrs.erc8183Jobs) {
    throw new Error("ARC_MANDATE_ANCHOR / ARC_AGENT_TREASURY / ARC_ERC8183_JOBS not set");
  }
  return {
    registrar: sepoliaAddrs.mandateRegistrar,
    anchor: arcAddrs.mandateAnchor,
    treasury: arcAddrs.agentTreasury,
    jobs: arcAddrs.erc8183Jobs,
  };
}


export function buildMandatedAgentTools(ctx: ToolContext) {
  const readMyMandate = betaZodTool({
    name: "read_my_mandate",
    description:
      "Resolve your own ENS mandate and return its current terms — budget, per-tx cap, expiry, allowlist, depth. Call this before any spend to see your actual limits; never assume them.",
    inputSchema: z.object({}),
    async run() {
      const { node, mandate } = await readMandateByEnsName(ctx.clients, ctx.ensName);
      const resolver = mandate.resolver;
      const allowHuman = await ctx.clients.sepolia.readContract({
        address: resolver,
        abi: PermissionedResolverAbi,
        functionName: "text",
        args: [node, "mandate.allow.human"],
      });
      return JSON.stringify({
        node,
        agentWallet: mandate.agentWallet,
        expiry: mandate.terms.expiry.toString(),
        budgetTotal: fromErc20Usdc(mandate.terms.budgetTotal),
        perTxCap: fromErc20Usdc(mandate.terms.perTxCap),
        budgetPeriodSeconds: mandate.terms.budgetPeriod,
        maxDepth: mandate.terms.maxDepth,
        allowedRecipients: parseAllowHuman(allowHuman),
        revoked: mandate.revoked,
      });
    },
  });

  const resolveEnsName = betaZodTool({
    name: "resolve_ens_name",
    description:
      "Resolve another agent's mandate by ENS name — check a counterparty's authority and standing before hiring or paying them.",
    inputSchema: z.object({ name: z.string().describe("e.g. 'scraper.research.acme.eth'") }),
    async run({ name }) {
      const { node, mandate } = await readMandateByEnsName(ctx.clients, name);
      return JSON.stringify({
        node,
        agentWallet: mandate.agentWallet,
        expiry: mandate.terms.expiry.toString(),
        revoked: mandate.revoked,
      });
    },
  });

  const checkTreasury = betaZodTool({
    name: "check_treasury",
    description: "Read your current Arc-side spend ledger — decayed budget spent, outstanding principal, and anchor liveness.",
    inputSchema: z.object({}),
    async run() {
      const { treasury } = requireAddresses();
      const anchor = await readArcAnchor(ctx.clients, ctx.signer.address);
      const [spentAccum, principal] = await ctx.clients.arc.readContract({
        address: treasury,
        abi: AgentTreasuryAbi,
        functionName: "accounts",
        args: [ctx.signer.address],
      });
      return JSON.stringify({
        spentThisWindow: fromErc20Usdc(spentAccum),
        principalOwed: fromErc20Usdc(principal),
        anchorUpdatedAt: anchor.updatedAt.toString(),
        anchorRevoked: anchor.revoked,
      });
    },
  });

  const setStatus = betaZodTool({
    name: "set_status",
    description: "Report your own status — one of the few records your mandate lets you write yourself.",
    inputSchema: z.object({ status: z.enum(["idle", "working", "blocked"]) }),
    async run({ status }) {
      const { node, mandate } = await readMandateByEnsName(ctx.clients, ctx.ensName);
      const data = encodeFunctionData({
        abi: PermissionedResolverAbi,
        functionName: "setText",
        args: [node, "agent.status", status],
      });
      const hash = await ctx.signer.sendTransaction("sepolia", { to: mandate.resolver, data });
      return `status set to ${status}, tx ${hash}`;
    },
  });

  const pay = betaZodTool({
    name: "pay",
    description:
      "Pay a counterparty directly from the treasury. This is the real spend path — it will revert if you're over budget, over cap, revoked, expired, or the recipient isn't allowlisted. Attempt it; don't guess whether it will succeed first.",
    inputSchema: z.object({
      to: z.string().describe("recipient address"),
      amountUsdc: z.string().describe("human-readable USDC amount, e.g. '12.50'"),
    }),
    async run({ to, amountUsdc }) {
      const { treasury } = requireAddresses();
      const { mandate } = await readMandateByEnsName(ctx.clients, ctx.ensName);
      const resolver = mandate.resolver;
      const node = namehash(ctx.ensName);
      const allowHuman = await ctx.clients.sepolia.readContract({
        address: resolver,
        abi: PermissionedResolverAbi,
        functionName: "text",
        args: [node, "mandate.allow.human"],
      });
      const recipients = parseAllowHuman(allowHuman);
      const proof = recipients.length > 0 ? buildAllowlist(recipients).proofFor(to as Address) : [];

      const data = encodeFunctionData({
        abi: AgentTreasuryAbi,
        functionName: "payTo",
        args: [to as Address, toErc20Usdc(amountUsdc), proof],
      });
      const hash = await ctx.signer.sendTransaction("arc", { to: treasury, data });
      return `payTo(${to}, ${amountUsdc}) submitted, tx ${hash} — check the receipt for revert reasons`;
    },
  });

  const createJob = betaZodTool({
    name: "create_job",
    description: "Create an ERC-8183 job with a provider and budget, funded from the treasury.",
    inputSchema: z.object({
      provider: z.string(),
      evaluator: z.string().describe("a third party who will judge the delivered work — never yourself"),
      description: z.string(),
      budgetUsdc: z.string(),
      expiresInDays: z.number().default(7),
    }),
    async run({ provider, evaluator, description, budgetUsdc, expiresInDays }) {
      const { jobs, treasury } = requireAddresses();
      const expiredAt = BigInt(Math.floor(Date.now() / 1000) + expiresInDays * 86_400);

      const createData = encodeFunctionData({
        abi: JobsAbi,
        functionName: "createJob",
        args: [provider as Address, evaluator as Address, expiredAt, description, "0x0000000000000000000000000000000000000000"],
      });
      const createHash = await ctx.signer.sendTransaction("arc", { to: jobs, data: createData });

      // fundJob (treasury -> escrow) needs the jobId the create call assigned, which the agent
      // reads back from the receipt/next jobCounter rather than assuming an id here.
      return `job created, tx ${createHash} — read jobCounter() to get the new jobId, then call payTo/fundJob against ${treasury} to fund it`;
    },
  });

  const submitWork = betaZodTool({
    name: "submit_work",
    description: "Submit a completed job's deliverable hash for evaluation.",
    inputSchema: z.object({ jobId: z.number(), deliverableHash: z.string().describe("bytes32 hash") }),
    async run({ jobId, deliverableHash }) {
      const { jobs } = requireAddresses();
      const data = encodeFunctionData({
        abi: JobsAbi,
        functionName: "submit",
        args: [BigInt(jobId), deliverableHash as `0x${string}`, "0x"],
      });
      const hash = await ctx.signer.sendTransaction("arc", { to: jobs, data });
      return `submitted job ${jobId}, tx ${hash}`;
    },
  });

  const issueSubmandate = betaZodTool({
    name: "issue_submandate",
    description:
      "Delegate a narrower mandate to a sub-agent. Will revert if it isn't strictly narrower than your own mandate in every dimension — that's enforced by the contract, not by you getting the numbers right.",
    inputSchema: z.object({
      label: z.string(),
      subAgentWallet: z.string(),
      subAgentArcWallet: z.string(),
      budgetTotalUsdc: z.string(),
      perTxCapUsdc: z.string(),
      expiresInDays: z.number(),
      budgetPeriodDays: z.number(),
      maxDepth: z.number(),
    }),
    async run(input) {
      const { registrar } = requireAddresses();
      const { node: parentNode, mandate } = await readMandateByEnsName(ctx.clients, ctx.ensName);

      const terms = {
        allowlistRoot: mandate.terms.allowlistRoot, // inherited verbatim, per MandateRegistrar's own design
        budgetTotal: toErc20Usdc(input.budgetTotalUsdc),
        perTxCap: toErc20Usdc(input.perTxCapUsdc),
        expiry: BigInt(Math.floor(Date.now() / 1000) + input.expiresInDays * 86_400),
        budgetPeriod: input.budgetPeriodDays * 86_400,
        maxDepth: input.maxDepth,
      };

      const data = encodeFunctionData({
        abi: MandateRegistrarAbi,
        functionName: "attenuate",
        args: [parentNode, input.label, input.subAgentWallet as Address, terms, input.subAgentArcWallet as Address, "[]"],
      });
      const hash = await ctx.signer.sendTransaction("sepolia", { to: registrar, data });
      return `attenuate(${input.label}) submitted, tx ${hash}`;
    },
  });

  return [
    readMyMandate,
    resolveEnsName,
    checkTreasury,
    setStatus,
    pay,
    createJob,
    submitWork,
    issueSubmandate,
  ];
}
