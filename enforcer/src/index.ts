import { PrivyClient } from "@privy-io/node";
import { loadEnforcerAccount, loadPrivyCredentials } from "./config.js";
import { startOrgSupervisor } from "./orgSupervisor.js";

async function main() {
  console.log("MANDATE Enforcer — starting");

  const account = loadEnforcerAccount();
  const { appId, appSecret } = loadPrivyCredentials();

  // @privy-io/node's PrivyClient has no constructor-level authorization-key option — an
  // org's own quorum-signed writes now go through a per-call `authorization_context`
  // instead (see `PrivyWalletsService`/`PrivyPoliciesService`'s `WithAuthorization` inputs).
  // `PRIVY_AUTHORIZATION_PRIVATE_KEY` was always optional and empty in every env file in this
  // repo, so nothing here regresses; wiring per-call authorization is Phase 2 (intents) work.
  const privy = new PrivyClient({ appId, appSecret });
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
