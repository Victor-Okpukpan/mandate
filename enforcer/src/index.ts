import { PrivyClient } from "@privy-io/server-auth";
import { loadEnforcerAccount, loadPrivyCredentials } from "./config.js";
import { startOrgSupervisor } from "./orgSupervisor.js";

async function main() {
  console.log("MANDATE Enforcer — starting");

  const account = loadEnforcerAccount();
  const { appId, appSecret, authorizationPrivateKey } = loadPrivyCredentials();

  const privy = new PrivyClient(
    appId,
    appSecret,
    authorizationPrivateKey ? { walletApi: { authorizationPrivateKey } } : undefined,
  );
  console.log(`[enforcer] signing as ${account.address}`);

  const supervisor = await startOrgSupervisor({ privy, arcAccount: account });

  const shutdown = () => {
    console.log("\n[enforcer] shutting down");
    supervisor.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[enforcer] fatal:", err);
  process.exit(1);
});
