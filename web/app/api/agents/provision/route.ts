import { getPrivyServerClient, requireAuthenticatedUser, UnauthorizedError } from "../../../../lib/privy";

/**
 * Creates a real Privy server wallet for a new agent — `wallets().create`. This is the
 * step that never existed in the repo before this route: nothing anywhere created an agent
 * wallet, so `/mandate/new` asked for an "Agent wallet" address that no part of the product could
 * produce. This route is that missing first step. The composer calls it, gets back a real
 * address, and uses it as both `agentWallet` (the ENS-side owner, granted the `agent.*` keys) and
 * `arcWallet` (the spending key) unless the operator chooses to differ.
 *
 * Auth-gated like every route under `web/app/api/**` — a signed-in org admin only. The wallet is
 * created with no policy attached; it gets one the moment the Enforcer's watcher syncs the
 * mandate that names it (`enforcer/src/watcher.ts` → `syncPolicyForWallet`), which is also the
 * only path that ever attaches or updates a policy — this route never touches policies.
 *
 * When `PRIVY_ENFORCER_QUORUM_ID` is set (after running
 * `enforcer/scripts/setup-authorization-quorum.ts`), the new wallet is immediately given that
 * quorum as its `owner_id` — a wallet with no owner accepts any app-secret-holding caller's
 * writes, not just this Enforcer's; see `enforcer/src/config.ts`'s
 * `loadEnforcerAuthorizationContext` NatSpec for the full model this closes. Unset, wallets are
 * provisioned exactly as before — ownerless.
 */
export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const client = getPrivyServerClient();
  let wallet;
  try {
    wallet = await client.wallets().create({ chain_type: "ethereum" });
  } catch (err) {
    return Response.json(
      { error: `Failed to provision wallet: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }

  const quorumId = process.env.PRIVY_ENFORCER_QUORUM_ID;
  if (quorumId) {
    try {
      await client.wallets().update(wallet.id, { owner_id: quorumId });
    } catch (err) {
      // The wallet exists and is otherwise usable — ownerless, same as before this feature
      // existed — so this doesn't fail the request. It DOES need to be visible, though: an
      // operator who set PRIVY_ENFORCER_QUORUM_ID expects every new wallet to be owned, and a
      // silent failure here would leave one unprotected with nothing pointing at why.
      console.error(`Failed to set owner_id=${quorumId} on new wallet ${wallet.id}:`, err);
    }
  }

  return Response.json({ address: wallet.address, walletId: wallet.id });
}
