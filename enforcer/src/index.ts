import { PrivyClient } from "@privy-io/server-auth";
import {
  HEARTBEAT_INTERVAL_MS,
  loadDeployedAddresses,
  loadEnforcerAccount,
  loadPrivyCredentials,
} from "./config.js";
import { startWatcher } from "./watcher.js";
import { startHeartbeatLoop } from "./heartbeat.js";
import { getArcAddresses } from "@mandate/shared/addresses";

async function main() {
  console.log("MANDATE Enforcer — starting");

  const account = loadEnforcerAccount();
  const { appId, appSecret, authorizationPrivateKey } = loadPrivyCredentials();
  const { mandateRegistrar, mandateAnchor, rpc } = loadDeployedAddresses();
  const { agentTreasury } = getArcAddresses();
  if (!agentTreasury) throw new Error("ARC_AGENT_TREASURY not set");

  const privy = new PrivyClient(
    appId,
    appSecret,
    authorizationPrivateKey ? { walletApi: { authorizationPrivateKey } } : undefined,
  );
  console.log(`[enforcer] signing as ${account.address}`);

  const watcher = await startWatcher({
    sepoliaRpcUrl: rpc.sepolia,
    registrarAddress: mandateRegistrar,
    anchorAddress: mandateAnchor,
    agentTreasuryAddress: agentTreasury,
    privy,
    arcAccount: account,
    arcRpcUrl: rpc.arc,
    walletRegistryPath: process.env.ENFORCER_WALLET_REGISTRY_PATH ?? "./wallet-registry.json",
  });

  const stopHeartbeat = startHeartbeatLoop(
    watcher.liveAgents,
    watcher.arcClients,
    mandateAnchor,
    HEARTBEAT_INTERVAL_MS,
  );

  const shutdown = () => {
    console.log("\n[enforcer] shutting down");
    watcher.stop();
    stopHeartbeat();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[enforcer] fatal:", err);
  process.exit(1);
});
