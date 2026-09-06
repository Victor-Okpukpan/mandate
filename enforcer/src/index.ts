import { PrivyClient } from "@privy-io/node";
import { loadEnforcerAccount, loadEnforcerAuthorizationContext, loadPrivyCredentials } from "./config.js";
import { startOrgSupervisor } from "./orgSupervisor.js";

async function main() {
  console.log("MANDATE Enforcer — starting");

  const account = loadEnforcerAccount();
  const { appId, appSecret } = loadPrivyCredentials();
  const authorizationContext = loadEnforcerAuthorizationContext();

  // @privy-io/node's PrivyClient has no constructor-level authorization-key option — a
  // quorum-owned wallet's writes go through a per-call `authorization_context` instead (see
  // `PrivyWalletsService`'s `WithAuthorization` inputs). `authorizationContext` above is
  // `undefined` until `enforcer/scripts/setup-authorization-quorum.ts` has been run — every
  // wallet this Enforcer touches is treated as ownerless until then, exactly as before this
  // existed. See `config.ts`'s `loadEnforcerAuthorizationContext` NatSpec for the full model.
  const privy = new PrivyClient({ appId, appSecret });
  console.log(`[enforcer] signing as ${account.address}`);
  console.log(
    authorizationContext
      ? "[enforcer] wallet-ownership authorization key loaded — owned wallets are reachable"
      : "[enforcer] no PRIVY_ENFORCER_AUTHORIZATION_KEY set — treating every wallet as ownerless",
  );

  const supervisor = await startOrgSupervisor({ privy, arcAccount: account, authorizationContext });

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
