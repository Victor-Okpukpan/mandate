import crypto from "node:crypto";
import { PrivyClient } from "@privy-io/node";

/**
 * One-time bootstrap for the wallet-ownership tier described in `enforcer/src/config.ts`'s
 * `loadEnforcerAuthorizationContext` NatSpec: generates a P-256 authorization keypair for this
 * Enforcer, registers the public half as a 1-of-1 Privy key quorum, and prints the two values that
 * need to land in `.env` — `PRIVY_ENFORCER_AUTHORIZATION_KEY` (the private key, kept only here and
 * in `.env`, never logged again after this run) and `PRIVY_ENFORCER_QUORUM_ID` (the quorum id
 * `POST /api/agents/provision` needs to hand new wallets an owner).
 *
 * Safe to run once and stop: nothing else in the codebase creates or depends on this quorum
 * existing until both env vars are set. Running it twice creates a second, independent quorum —
 * harmless, but only one should end up wired into `.env`.
 *
 * Usage: `pnpm --filter @mandate/enforcer exec tsx scripts/setup-authorization-quorum.ts`
 * (needs PRIVY_APP_ID / PRIVY_APP_SECRET in the environment, same as the Enforcer itself).
 */
async function main() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Missing PRIVY_APP_ID / PRIVY_APP_SECRET — set them the same way the Enforcer itself needs them.");
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const privateKeyBase64 = privateKey.export({ type: "pkcs8", format: "der" }).toString("base64");
  const publicKeyBase64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

  const client = new PrivyClient({ appId, appSecret });
  const quorum = await client.keyQuorums().create({
    display_name: "enforcer-wallet-ownership",
    authorization_threshold: 1,
    public_keys: [publicKeyBase64],
  });

  console.log("\nCreated key quorum:", quorum.id);
  console.log("\nAdd these to your .env (never commit the key):\n");
  console.log(`PRIVY_ENFORCER_AUTHORIZATION_KEY=${privateKeyBase64}`);
  console.log(`PRIVY_ENFORCER_QUORUM_ID=${quorum.id}`);
  console.log(
    "\nThen restart the Enforcer, set PRIVY_ENFORCER_QUORUM_ID on web's own environment too " +
      "(POST /api/agents/provision reads it), and run migrate-existing-wallets.ts to backfill " +
      "any wallet provisioned before this quorum existed.",
  );
}

main().catch((err) => {
  console.error("setup-authorization-quorum failed:", err);
  process.exit(1);
});
