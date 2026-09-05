import { getPrivyServerClient, requireAuthenticatedUser, UnauthorizedError } from "../../../../lib/privy";

/**
 * Lists every Privy server wallet in the org's app — `walletApi.getWallets()`. This is also what
 * lets the dashboard resolve "which Privy wallet backs this mandate's agentWallet address"
 * without a local registry file: the Enforcer used to depend on a hand-maintained
 * `wallet-registry.json` that nothing ever wrote (see enforcer/README.md); this endpoint and
 * `getWallets()` itself are the fix, live, on both sides.
 *
 * There is no `listPolicies` in the SDK (confirmed against the installed `.d.ts`), so a caller
 * that wants a wallet's policy rules fans out to `GET /api/privy/policies/[id]` using the
 * `policyIds` this returns.
 */
export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;

  try {
    const page = await getPrivyServerClient().walletApi.getWallets({ chainType: "ethereum", cursor });
    return Response.json({
      wallets: page.data.map((w) => ({
        id: w.id,
        address: w.address,
        policyIds: w.policyIds,
        createdAt: w.createdAt,
      })),
      nextCursor: page.nextCursor ?? null,
    });
  } catch (err) {
    return Response.json(
      { error: `Failed to list wallets: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
