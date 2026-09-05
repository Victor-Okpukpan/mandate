import { getPrivyServerClient, requireAuthenticatedUser, UnauthorizedError } from "../../../../lib/privy";

/**
 * Creates a real Privy server wallet for a new agent — `walletApi.createWallet`. This is the
 * step that never existed in the repo before this route: nothing anywhere created an agent
 * wallet, so `/mandate/new` asked for an "Agent wallet" address that no part of the product could
 * produce. This route is that missing first step. The composer calls it, gets back a real
 * address, and uses it as both `agentWallet` (the ENS-side owner, granted the `agent.*` keys) and
 * `arcWallet` (the spending key) unless the operator chooses to differ.
 *
 * Auth-gated like every route under `web/app/api/**` — a signed-in org admin only. The wallet is
 * created bare, with no policy attached; it gets one the moment the Enforcer's watcher syncs the
 * mandate that names it (`enforcer/src/watcher.ts` → `syncPolicyForWallet`), which is also the
 * only path that ever attaches or updates a policy — this route never touches policies.
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

  try {
    const wallet = await getPrivyServerClient().walletApi.createWallet({ chainType: "ethereum" });
    return Response.json({ address: wallet.address, walletId: wallet.id });
  } catch (err) {
    return Response.json(
      { error: `Failed to provision wallet: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
