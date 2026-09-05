import { sepolia } from "viem/chains";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { PrivyClient } from "@privy-io/server-auth";
import { MandateAnchorAbi, MandateRegistrarAbi, PermissionedResolverAbi } from "@mandate/shared/abis";
import { MANDATE_KEYS } from "@mandate/shared/ensKeys";
import { parseAllowHuman } from "@mandate/shared/allowHuman";
import { revokePolicyForWallet, syncPolicyForWallet } from "./privyPolicy.js";
import { makeArcClients, submitSync, type SyncPayload } from "./arcSync.js";
import type { PrivateKeyAccount } from "viem/accounts";

export interface WatcherDeps {
  sepoliaRpcUrl: string;
  registrarAddress: Address;
  anchorAddress: Address;
  agentTreasuryAddress: Address;
  privy: PrivyClient;
  arcAccount: PrivateKeyAccount;
  arcRpcUrl: string;
}

/**
 * Agent wallet address -> Privy wallet id. Previously a hand-maintained JSON file
 * (`wallet-registry.json`) that nothing ever wrote — every sync found it empty and skipped policy
 * sync entirely, so zero policies were ever created at runtime. `walletApi.getWallets()` already
 * returns `address` + `id` for every server wallet in the app, which is the same information the
 * file was meant to hold, live and without a second thing to keep in sync. Paginates because
 * `getWallets` returns at most one page per call.
 */
async function loadWalletsByAddress(privy: PrivyClient): Promise<Map<Address, string>> {
  const byAddress = new Map<Address, string>();
  let cursor: string | undefined;
  do {
    const page = await privy.walletApi.getWallets({ chainType: "ethereum", cursor });
    for (const wallet of page.data) {
      byAddress.set(wallet.address.toLowerCase() as Address, wallet.id);
    }
    cursor = page.nextCursor;
  } while (cursor);
  return byAddress;
}

/** Per-agent nonce for `MandateAnchor.syncMandate` — strictly monotonic, per the contract's own
 *  invariant. Cached in memory after first use within a process, but ALWAYS seeded from the
 *  anchor's actual on-chain nonce the first time a given agent is synced — a fresh, in-memory-only
 *  counter would restart at 0 after any Enforcer restart and revert every sync thereafter with
 *  `MandateAnchor__NonceNotMonotonic` against an agent that already has anchor state. */
const nonceByAgent = new Map<Address, bigint>();

async function nextNonceFor(
  agent: Address,
  arcClients: ReturnType<typeof makeArcClients>,
  anchorAddress: Address,
): Promise<bigint> {
  if (!nonceByAgent.has(agent)) {
    const anchor = await arcClients.publicClient.readContract({
      address: anchorAddress,
      abi: MandateAnchorAbi,
      functionName: "anchors",
      args: [agent],
    });
    const [, , , , , , updatedAt, currentNonce] = anchor;
    // updatedAt == 0 means this agent has never been synced — MandateAnchor's own
    // isFirstSync check accepts any starting nonce in that case, so 0 is a safe start.
    nonceByAgent.set(agent, updatedAt === 0n ? -1n : currentNonce);
  }
  const next = nonceByAgent.get(agent)! + 1n;
  nonceByAgent.set(agent, next);
  return next;
}

export async function startWatcher(deps: WatcherDeps) {
  const sepoliaClient = createPublicClient({ chain: sepolia, transport: http(deps.sepoliaRpcUrl) });
  const arcClients = makeArcClients(deps.arcRpcUrl, deps.arcAccount);
  /** Agents with a live (non-revoked) mandate — the heartbeat loop reads this directly. */
  const liveAgents = new Set<Address>();

  async function syncNode(node: Hex, reason: "issued" | "amended" | "revoked") {
    const mandate = await sepoliaClient.readContract({
      address: deps.registrarAddress,
      abi: MandateRegistrarAbi,
      functionName: "getMandate",
      args: [node],
    });
    const termsHash = await sepoliaClient.readContract({
      address: deps.registrarAddress,
      abi: MandateRegistrarAbi,
      functionName: "mandateHash",
      args: [node],
    });

    const agent = mandate.agentWallet;
    const revoked = reason === "revoked" || mandate.revoked;
    const nonce = await nextNonceFor(agent, arcClients, deps.anchorAddress);

    const payload: SyncPayload = {
      agent,
      node,
      termsHash,
      expiry: mandate.terms.expiry,
      budgetTotal: mandate.terms.budgetTotal,
      budgetPeriod: mandate.terms.budgetPeriod,
      perTxCap: mandate.terms.perTxCap,
      allowlistRoot: mandate.terms.allowlistRoot,
      nonce,
      revoked,
    };

    const txHash = await submitSync(arcClients, deps.anchorAddress, payload);
    console.log(`[arc] synced ${node} (${reason}) agent=${agent} tx=${txHash}`);

    if (revoked) {
      liveAgents.delete(agent);
    } else {
      liveAgents.add(agent);
    }

    const walletsByAddress = await loadWalletsByAddress(deps.privy);
    const walletId = walletsByAddress.get(agent.toLowerCase() as Address);
    if (!walletId) {
      console.warn(`[privy] no Privy server wallet found for ${agent} — skipping policy sync`);
      return;
    }

    if (revoked) {
      // The kill switch's off-chain half: rewrite the policy to a bare DENY *, fail-closed on
      // Privy independently of the on-chain anchor flip below. Not a detach — a wallet with no
      // policy at all may default permissive, which is the opposite of what revocation means.
      await revokePolicyForWallet(deps.privy, walletId);
      console.log(`[privy] wallet ${walletId} (${agent}) revoked — policy rewritten to deny-all`);
    } else {
      const allowHumanJson = await sepoliaClient.readContract({
        address: mandate.resolver,
        abi: PermissionedResolverAbi,
        functionName: "text",
        args: [node, MANDATE_KEYS.allowHuman],
      });
      const allowedRecipients = parseAllowHuman(allowHumanJson);
      if (allowedRecipients.length === 0) {
        console.warn(
          `[privy] ${node} has an empty mandate.allow.human — an 'in' condition over an empty ` +
            `list matches nothing, so skipping policy sync rather than compiling a policy no ` +
            `payment could ever pass.`,
        );
        return;
      }
      const { policyId } = await syncPolicyForWallet(deps.privy, walletId, node, {
        agentTreasury: deps.agentTreasuryAddress,
        perTxCapUsdcBaseUnits: mandate.terms.perTxCap,
        allowedRecipients,
      });
      console.log(`[privy] policy ${policyId} synced to wallet ${walletId} (${agent})`);
    }
  }

  // Backfill: catch up on everything the registrar has ever emitted before subscribing live.
  const [issuedLogs, amendedLogs, revokedLogs] = await Promise.all([
    sepoliaClient.getContractEvents({
      address: deps.registrarAddress,
      abi: MandateRegistrarAbi,
      eventName: "MandateIssued",
      fromBlock: "earliest",
      toBlock: "latest",
    }),
    sepoliaClient.getContractEvents({
      address: deps.registrarAddress,
      abi: MandateRegistrarAbi,
      eventName: "MandateAmended",
      fromBlock: "earliest",
      toBlock: "latest",
    }),
    sepoliaClient.getContractEvents({
      address: deps.registrarAddress,
      abi: MandateRegistrarAbi,
      eventName: "MandateRevoked",
      fromBlock: "earliest",
      toBlock: "latest",
    }),
  ]);

  const backfillOrdered = [
    ...issuedLogs.map((l) => ({ node: l.args.node!, reason: "issued" as const, blockNumber: l.blockNumber })),
    ...amendedLogs.map((l) => ({ node: l.args.node!, reason: "amended" as const, blockNumber: l.blockNumber })),
    ...revokedLogs.map((l) => ({ node: l.args.node!, reason: "revoked" as const, blockNumber: l.blockNumber })),
  ].sort((a, b) => Number(a.blockNumber - b.blockNumber));

  for (const entry of backfillOrdered) {
    await syncNode(entry.node, entry.reason).catch((err) =>
      console.error(`[watcher] backfill sync failed for ${entry.node}:`, err),
    );
  }

  // Live: everything after the backfill.
  const unwatchIssued = sepoliaClient.watchContractEvent({
    address: deps.registrarAddress,
    abi: MandateRegistrarAbi,
    eventName: "MandateIssued",
    onLogs: (logs) => logs.forEach((l) => syncNode(l.args.node!, "issued").catch(console.error)),
  });
  const unwatchAmended = sepoliaClient.watchContractEvent({
    address: deps.registrarAddress,
    abi: MandateRegistrarAbi,
    eventName: "MandateAmended",
    onLogs: (logs) => logs.forEach((l) => syncNode(l.args.node!, "amended").catch(console.error)),
  });
  const unwatchRevoked = sepoliaClient.watchContractEvent({
    address: deps.registrarAddress,
    abi: MandateRegistrarAbi,
    eventName: "MandateRevoked",
    onLogs: (logs) => logs.forEach((l) => syncNode(l.args.node!, "revoked").catch(console.error)),
  });

  console.log(`[watcher] live, watching ${deps.registrarAddress} on Sepolia`);

  return {
    liveAgents,
    arcClients,
    stop: () => {
      unwatchIssued();
      unwatchAmended();
      unwatchRevoked();
    },
  };
}
