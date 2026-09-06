import { getPrivyServerClient, requireAuthenticatedUser, UnauthorizedError } from "../../../../../lib/privy";

/**
 * Attaches a wallet to an approval tier by setting its `owner_id` to a key quorum
 * (`POST /api/privy/key-quorums`). Verified live: setting `owner_id` on a wallet with no existing
 * owner succeeds with app-secret authority alone — no signature needed, since there is no prior
 * owner to sign off. Once a wallet has an owner, every *subsequent* update — including changing
 * the owner again — requires that owner's threshold of signatures (see `web/lib/approvals.ts`),
 * which is exactly the point: this route is the one-time "assign this wallet to a tier" step, not
 * a way to bypass approval afterward.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const ownerId = typeof body?.ownerId === "string" ? body.ownerId : undefined;
  if (!ownerId) {
    return Response.json({ error: "ownerId (a key quorum id) is required." }, { status: 400 });
  }

  try {
    const wallet = await getPrivyServerClient().wallets().update(id, { owner_id: ownerId });
    return Response.json({ id: wallet.id, ownerId: wallet.owner_id ?? null });
  } catch (err) {
    return Response.json(
      {
        error:
          `Failed to attach wallet ${id} to quorum ${ownerId}: ` +
          `${err instanceof Error ? err.message : String(err)}. If the wallet already has an ` +
          `owner, this needs to go through /api/approvals instead — a direct app-secret call ` +
          `can no longer reassign it.`,
      },
      { status: 502 },
    );
  }
}
