import { getPrivyServerClient, requireAuthenticatedUser, UnauthorizedError } from "../../../../lib/privy";

/**
 * Creates a Privy key quorum — an approval tier. `authorization_threshold` members must sign
 * (via `web/lib/approvals.ts`) before an action gated by this quorum executes. This is the
 * primitive HOW-IT-WORKS.md's approvals layer sits on: an org defines one quorum per tier (e.g.
 * "ops" 1-of-1, "finance" 2-of-3), then attaches a wallet to a tier via its `owner_id`
 * (`PATCH /api/privy/wallets/[id]`).
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

  const body = await request.json().catch(() => null);
  const displayName = typeof body?.displayName === "string" ? body.displayName : undefined;
  const threshold = typeof body?.threshold === "number" ? body.threshold : undefined;
  const publicKeys = Array.isArray(body?.publicKeys) ? (body.publicKeys as string[]) : undefined;
  const userIds = Array.isArray(body?.userIds) ? (body.userIds as string[]) : undefined;

  if (!displayName || !threshold || (!publicKeys?.length && !userIds?.length)) {
    return Response.json(
      { error: "displayName, threshold, and at least one of publicKeys/userIds are required." },
      { status: 400 },
    );
  }

  try {
    const quorum = await getPrivyServerClient().keyQuorums().create({
      display_name: displayName,
      authorization_threshold: threshold,
      public_keys: publicKeys,
      user_ids: userIds,
    });
    return Response.json({
      id: quorum.id,
      displayName: quorum.display_name,
      threshold: quorum.authorization_threshold,
      memberCount: quorum.authorization_keys.length + (quorum.user_ids?.length ?? 0),
    });
  } catch (err) {
    return Response.json(
      { error: `Failed to create key quorum: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
