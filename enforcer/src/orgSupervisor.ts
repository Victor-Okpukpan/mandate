import { sepolia, arcTestnet } from "viem/chains";
import { createPublicClient, http, type Address } from "viem";
import type { PrivyClient } from "@privy-io/node";
import type { PrivateKeyAccount } from "viem/accounts";
import { ArcVaultFactoryAbi, MandateAnchorAbi, MandateOrgFactoryAbi, MandateRegistrarAbi } from "@mandate/shared/abis";
import { listOrgs, listVaults, joinOrgVaults, type OrgWithVault } from "@mandate/shared/orgs";
import { loadFactories, loadSingleOrgFallback, MAX_STALENESS_SECONDS } from "./config.js";
import { startWatcher, type WatcherDeps } from "./watcher.js";
import { startHeartbeatLoop } from "./heartbeat.js";
import { createWalletCache } from "./walletCache.js";

export interface SupervisorDeps {
  privy: PrivyClient;
  arcAccount: PrivateKeyAccount;
  /** See `WatcherDeps`'s own field of the same name — passed through unchanged, one Enforcer
   *  process shares one authorization key across every org it watches. */
  authorizationContext?: { authorization_private_keys: string[] };
}

/**
 * Turns "one Enforcer watches one hard-coded org" into "one Enforcer watches every org the
 * platform's factories have ever created" — HOW-IT-WORKS.md §4's "`OrgCreated` makes the Enforcer
 * self-serve. It watches the factory rather than a hard-coded address, so a new org is picked up
 * automatically with no redeploy." Falls back to the single-org env vars when no factory is
 * configured, so this still runs unmodified on a pre-factory deployment.
 */
export async function startOrgSupervisor(deps: SupervisorDeps) {
  const { orgFactory, vaultFactory, orgFactoryFromBlock, vaultFactoryFromBlock, rpc } = loadFactories();
  const wallets = createWalletCache(deps.privy);
  const running = new Map<string, { stopWatcher: () => void; stopHeartbeat: () => void }>();

  async function startOrg(org: OrgWithVault) {
    if (running.has(org.registrar)) return; // already watching this registrar
    if (!org.vault) {
      console.warn(`[supervisor] ${org.orgEnsName} (${org.registrar}) has no Arc vault yet — skipping`);
      return;
    }

    // The real safety property this whole multi-org design rests on: an org's Sepolia registrar
    // and its Arc anchor must actually be the same admin's, and this Enforcer must actually be
    // the anchor's registered signer. `orgRootNode` matching (ArcVaultFactory.createVaultFor's own
    // tag) is an assertion, not a proof — this is the proof. One bad org fails this check and gets
    // skipped-and-logged; it must never take the whole process down.
    try {
      const sepoliaClient = createPublicClient({ chain: sepolia, transport: http(rpc.sepolia) });
      const arcClient = createPublicClient({ chain: arcTestnet, transport: http(rpc.arc) });
      const [registrarOwner, anchorOwner, anchorEnforcer] = await Promise.all([
        sepoliaClient.readContract({
          address: org.registrar,
          abi: MandateRegistrarAbi,
          functionName: "owner",
        }),
        arcClient.readContract({ address: org.vault.anchor, abi: MandateAnchorAbi, functionName: "owner" }),
        arcClient.readContract({ address: org.vault.anchor, abi: MandateAnchorAbi, functionName: "enforcer" }),
      ]);
      if (registrarOwner.toLowerCase() !== anchorOwner.toLowerCase()) {
        console.warn(
          `[supervisor] ${org.orgEnsName}: registrar owner ${registrarOwner} != anchor owner ` +
            `${anchorOwner} — refusing to serve this org (owner mismatch across chains).`,
        );
        return;
      }
      if (anchorEnforcer.toLowerCase() !== deps.arcAccount.address.toLowerCase()) {
        console.warn(
          `[supervisor] ${org.orgEnsName}: anchor's registered enforcer ${anchorEnforcer} is not ` +
            `this Enforcer's key (${deps.arcAccount.address}) — refusing to serve this org.`,
        );
        return;
      }
    } catch (err) {
      console.error(`[supervisor] owner-equality check failed for ${org.orgEnsName}, skipping:`, err);
      return;
    }

    console.log(`[supervisor] starting watcher for ${org.orgEnsName} (${org.registrar})`);
    const watcherDeps: WatcherDeps = {
      sepoliaRpcUrl: rpc.sepolia,
      registrarAddress: org.registrar,
      anchorAddress: org.vault.anchor,
      agentTreasuryAddress: org.vault.treasury,
      privy: deps.privy,
      wallets,
      arcAccount: deps.arcAccount,
      arcRpcUrl: rpc.arc,
      authorizationContext: deps.authorizationContext,
    };

    try {
      const watcher = await startWatcher(watcherDeps);
      const stopHeartbeat = startHeartbeatLoop(
        watcher.liveAgents,
        watcher.arcClients,
        org.vault.anchor,
        (MAX_STALENESS_SECONDS / 3) * 1000,
      );
      running.set(org.registrar, { stopWatcher: watcher.stop, stopHeartbeat });
    } catch (err) {
      console.error(`[supervisor] failed to start watcher for ${org.orgEnsName}:`, err);
    }
  }

  if (!orgFactory || !vaultFactory) {
    console.log("[supervisor] no factories configured — running the single-org fallback");
    const fallback = loadSingleOrgFallback();
    await startOrg({
      registrar: fallback.mandateRegistrar,
      orgRootRegistry: fallback.mandateRegistrar,
      admin: fallback.mandateRegistrar, // unused by startOrg beyond logging; not load-bearing
      orgRootNode: `0x${"0".repeat(64)}`,
      orgEnsName: "mandate.eth",
      createdAtBlock: 0n,
      vault: {
        anchor: fallback.mandateAnchor,
        treasury: fallback.agentTreasury,
        admin: fallback.mandateRegistrar,
        enforcer: deps.arcAccount.address,
        orgRootNode: `0x${"0".repeat(64)}`,
        createdAtBlock: 0n,
      },
    });
    return {
      stop: () => {
        for (const r of running.values()) {
          r.stopWatcher();
          r.stopHeartbeat();
        }
      },
    };
  }

  const sepoliaClient = createPublicClient({ chain: sepolia, transport: http(rpc.sepolia) });
  const arcClient = createPublicClient({ chain: arcTestnet, transport: http(rpc.arc) });

  console.log(`[supervisor] backfilling orgs from ${orgFactory} and vaults from ${vaultFactory}`);
  const [orgs, vaults] = await Promise.all([
    listOrgs(sepoliaClient, orgFactory, orgFactoryFromBlock),
    listVaults(arcClient, vaultFactory, vaultFactoryFromBlock),
  ]);
  const joined = joinOrgVaults(orgs, vaults);
  console.log(`[supervisor] found ${orgs.length} org(s), ${vaults.length} vault(s), ${joined.filter((o) => o.vault).length} joined`);

  for (const org of joined) {
    await startOrg(org);
  }

  // Live: an org onboarded through the wizard a moment ago must be picked up with no restart —
  // that's the entire point of self-serve onboarding (HOW-IT-WORKS.md §4). Vaults can arrive
  // before or after their org's Sepolia log depending on how quickly the wizard's admin completes
  // both chains' steps, so both watchers re-attempt the join on every new log from either side.
  const knownOrgs = new Map(orgs.map((o) => [o.orgRootNode, o] as const));
  const knownVaults = new Map(vaults.map((v) => [v.orgRootNode, v] as const));

  const unwatchOrgs = sepoliaClient.watchContractEvent({
    address: orgFactory,
    abi: MandateOrgFactoryAbi,
    eventName: "OrgCreated",
    onLogs: (logs) => {
      for (const log of logs) {
        const org: OrgWithVault = {
          registrar: log.args.registrar!,
          orgRootRegistry: log.args.orgRootRegistry!,
          admin: log.args.admin!,
          orgRootNode: log.args.orgRootNode!,
          orgEnsName: log.args.orgEnsName!,
          createdAtBlock: log.blockNumber!,
          vault: knownVaults.get(log.args.orgRootNode!),
        };
        knownOrgs.set(org.orgRootNode, org);
        startOrg(org).catch((err) => console.error(`[supervisor] live OrgCreated handling failed:`, err));
      }
    },
  });

  const unwatchVaults = arcClient.watchContractEvent({
    address: vaultFactory,
    abi: ArcVaultFactoryAbi,
    eventName: "VaultCreated",
    onLogs: (logs) => {
      for (const log of logs) {
        const vault = {
          anchor: log.args.anchor!,
          treasury: log.args.treasury!,
          admin: log.args.admin!,
          enforcer: log.args.enforcer!,
          orgRootNode: log.args.orgRootNode!,
          createdAtBlock: log.blockNumber!,
        };
        knownVaults.set(vault.orgRootNode, vault);
        const org = knownOrgs.get(vault.orgRootNode);
        if (org) {
          startOrg({ ...org, vault }).catch((err) =>
            console.error(`[supervisor] live VaultCreated handling failed:`, err),
          );
        }
      }
    },
  });

  console.log(`[supervisor] live, watching factories for new orgs and vaults`);

  return {
    stop: () => {
      unwatchOrgs();
      unwatchVaults();
      for (const r of running.values()) {
        r.stopWatcher();
        r.stopHeartbeat();
      }
    },
  };
}
