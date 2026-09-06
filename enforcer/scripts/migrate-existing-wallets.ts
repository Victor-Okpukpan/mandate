import { PrivyClient } from "@privy-io/node";

/**
 * Backfills every ownerless wallet in this Privy app to the quorum
 * `setup-authorization-quorum.ts` created — the migration half of the wallet-ownership tier (see
 * `enforcer/src/config.ts`'s `loadEnforcerAuthorizationContext` NatSpec). A wallet with no owner
 * accepts an `owner_id` from app-secret authority alone (verified live this session — no
 * signature required to set an owner where none exists yet), so this needs no authorization
 * context of its own; it's exactly the same call `POST /api/agents/provision` now makes for a
 * brand-new wallet, just run once over every wallet that predates that change.
 *
 * Idempotent: skips any wallet that already has an `owner_id` (whether it's this quorum or
 * another one an operator set by hand) rather than overwriting it.
 *
 * Usage: `pnpm --filter @mandate/enforcer exec tsx scripts/migrate-existing-wallets.ts`
 * (needs PRIVY_APP_ID / PRIVY_APP_SECRET / PRIVY_ENFORCER_QUORUM_ID in the environment).
 */
async function main() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const quorumId = process.env.PRIVY_ENFORCER_QUORUM_ID;
  if (!appId || !appSecret) throw new Error("Missing PRIVY_APP_ID / PRIVY_APP_SECRET");
  if (!quorumId) throw new Error("Missing PRIVY_ENFORCER_QUORUM_ID — run setup-authorization-quorum.ts first");

  const client = new PrivyClient({ appId, appSecret });

  let migrated = 0;
  let skipped = 0;
  let cursor: string | undefined;
  do {
    const page = await client.wallets().list({ chain_type: "ethereum", cursor });
    for (const wallet of page.data) {
      if (wallet.owner_id) {
        skipped++;
        continue;
      }
      await client.wallets().update(wallet.id, { owner_id: quorumId });
      migrated++;
      console.log(`  migrated ${wallet.id} (${wallet.address})`);
    }
    cursor = page.next_cursor ?? undefined;
  } while (cursor);

  console.log(`\nDone — migrated ${migrated}, skipped ${skipped} already-owned wallet(s).`);
}

main().catch((err) => {
  console.error("migrate-existing-wallets failed:", err);
  process.exit(1);
});
