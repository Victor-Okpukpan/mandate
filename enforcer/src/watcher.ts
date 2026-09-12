import { sepolia } from "viem/chains";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { PrivyClient } from "@privy-io/node";
import { MandateAnchorAbi, MandateRegistrarAbi, PermissionedResolverAbi } from "@mandate/shared/abis";
import { MANDATE_KEYS } from "@mandate/shared/ensKeys";
import { parseAllowHuman } from "@mandate/shared/allowHuman";
import { getContractEventsChunked } from "@mandate/shared/eventLogs";
import { detachPolicyIfPresent, revokePolicyForWallet, syncPolicyForWallet } from "./privyPolicy.js";
import { PRIVY_POLICY_SYNC_ENABLED } from "./config.js";
import { makeArcClients, submitSync, type SyncPayload } from "./arcSync.js";
import type { WalletCache } from "./walletCache.js";
import type { PrivateKeyAccount } from "viem/accounts";

export interface WatcherDeps {
  sepoliaRpcUrl: string;
  registrarAddress: Address;
  /** The block `registrarAddress` was created at — `MandateOrgFactory.OrgCreated`'s own
   *  `createdAtBlock` for this org. Backfilling from `"earliest"` (Sepolia genesis) instead is not
   *  merely wasteful, it's already broken: `eth_getLogs` is range-capped (see
   *  `@mandate/shared/eventLogs`'s own NatSpec), and Sepolia is deep enough now that
   *  genesis-to-latest exceeds that cap on the very first call for a brand-new org. */
  registrarFromBlock: bigint;
  anchorAddress: Address;
  agentTreasuryAddress: Address;
  privy: PrivyClient;
  /** Shared across every org this Enforcer process watches — see `walletCache.ts`'s own
   *  NatSpec-style comment on why this isn't fetched fresh per sync. */
  wallets: WalletCache;
  arcAccount: PrivateKeyAccount;
  arcRpcUrl: string;
  /** From `config.ts`'s `loadEnforcerAuthorizationContext()` — `undefined` on a deployment that
   *  hasn't run `enforcer/scripts/setup-authorization-quorum.ts` yet, in which case every wallet
   *  this Enforcer touches is assumed ownerless, exactly as before this existed. */
  authorizationContext?: { authorization_private_keys: string[] };
}

export async function startWatcher(deps: WatcherDeps) {
  const sepoliaClient = createPublicClient({ chain: sepolia, transport: http(deps.sepoliaRpcUrl) });
  const arcClients = makeArcClients(deps.arcRpcUrl, deps.arcAccount);
  /** Agents with a live (non-revoked) mandate — the heartbeat loop reads this directly. */
  const liveAgents = new Set<Address>();

  /** Per-agent nonce for `MandateAnchor.syncMandate` — strictly monotonic, per the contract's own
   *  invariant. Scoped to THIS watcher instance (one per org, one anchor each) rather than a
   *  module-level map — a shared map keyed by agent alone was a real latent bug once a single
   *  Enforcer process watches more than one org: nonces are actually per-`(anchor, agent)`, so two
   *  orgs sharing one map would seed org B's nonce from org A's state and revert every sync with
   *  `MandateAnchor__NonceNotMonotonic`. Cached after first use, but ALWAYS seeded from this
   *  anchor's actual on-chain nonce the first time a given agent is synced — a fresh,
   *  in-memory-only counter would restart at 0 after any Enforcer restart and revert every sync
   *  thereafter against an agent that already has anchor state. */
  const nonceByAgent = new Map<Address, bigint>();

  async function nextNonceFor(agent: Address): Promise<bigint> {
    if (!nonceByAgent.has(agent)) {
      const anchor = await arcClients.publicClient.readContract({
        address: deps.anchorAddress,
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
    const nonce = await nextNonceFor(agent);

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

    let walletsByAddress = await deps.wallets.get();
    let walletId = walletsByAddress.get(agent.toLowerCase() as Address);
    if (!walletId) {
      // The composer provisions a wallet and issues its mandate in the same flow, seconds apart —
      // easily inside the cache's TTL window. One forced refetch before giving up, rather than
      // making every sync pay for a cache that's usually still fresh.
      deps.wallets.invalidate();
      walletsByAddress = await deps.wallets.get();
      walletId = walletsByAddress.get(agent.toLowerCase() as Address);
    }
    if (!walletId) {
      console.warn(`[privy] no Privy server wallet found for ${agent} — skipping policy sync`);
      return;
    }

    if (!PRIVY_POLICY_SYNC_ENABLED) {
      // See PRIVY_POLICY_SYNC_ENABLED's own doc comment in config.ts: any policy on a wallet
      // blocks it from signing on Arc at all right now, so this strips a leftover one (from before
      // that was known, or from the flag being flipped) instead of attaching/rewriting one. The
      // on-chain anchor flip above is the real, sole enforcement for Arc payments while this is off.
      const cleared = await detachPolicyIfPresent(deps.privy, walletId);
      if (cleared) console.log(`[privy] policy sync disabled — cleared leftover policy on wallet ${walletId} (${agent})`);
      return;
    }

    if (revoked) {
      // The kill switch's off-chain half: rewrite the policy to a bare DENY *, fail-closed on
      // Privy independently of the on-chain anchor flip below. Not a detach — a wallet with no
      // policy at all may default permissive, which is the opposite of what revocation means.
      await revokePolicyForWallet(deps.privy, walletId, deps.authorizationContext);
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
      const { policyId } = await syncPolicyForWallet(
        deps.privy,
        walletId,
        node,
        {
          agentTreasury: deps.agentTreasuryAddress,
          perTxCapUsdcBaseUnits: mandate.terms.perTxCap,
          allowedRecipients,
        },
        deps.authorizationContext,
      );
      console.log(`[privy] policy ${policyId} synced to wallet ${walletId} (${agent})`);
    }
  }

  // Backfill: catch up on everything the registrar has ever emitted before subscribing live.
  const [issuedLogs, amendedLogs, revokedLogs] = await Promise.all([
    getContractEventsChunked(sepoliaClient, {
      address: deps.registrarAddress,
      abi: MandateRegistrarAbi,
      eventName: "MandateIssued",
      fromBlock: deps.registrarFromBlock,
    }),
    getContractEventsChunked(sepoliaClient, {
      address: deps.registrarAddress,
      abi: MandateRegistrarAbi,
      eventName: "MandateAmended",
      fromBlock: deps.registrarFromBlock,
    }),
    getContractEventsChunked(sepoliaClient, {
      address: deps.registrarAddress,
      abi: MandateRegistrarAbi,
      eventName: "MandateRevoked",
      fromBlock: deps.registrarFromBlock,
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
