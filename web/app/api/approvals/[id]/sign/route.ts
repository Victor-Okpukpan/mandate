import { requireAuthenticatedUser, UnauthorizedError } from "../../../../../lib/privy";
import { getApproval, signApproval } from "../../../../../lib/approvals";

/**
 * One signer's contribution to a pending approval. `authorizationPrivateKey` is a base64-encoded
 * PKCS8 P-256 private key, sent once, used in-process to compute this single signature, and
 * discarded — `web/lib/approvals.ts` never writes it anywhere. Executes the underlying action the
 * moment the threshold is met.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: err.message }, { status: 401 });
    throw err;
  }

  const { id } = await params;
  if (!getApproval(id)) {
    return Response.json({ error: `No pending approval ${id}.` }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const authorizationPrivateKey =
    typeof body?.authorizationPrivateKey === "string" ? body.authorizationPrivateKey : undefined;
  if (!authorizationPrivateKey) {
    return Response.json({ error: "authorizationPrivateKey is required." }, { status: 400 });
  }

  const appId = process.env.PRIVY_APP_ID;
  if (!appId) return Response.json({ error: "PRIVY_APP_ID not configured." }, { status: 503 });

  try {
    const approval = await signApproval(id, authorizationPrivateKey, appId);
    return Response.json({
      id: approval.id,
      threshold: approval.threshold,
      signatureCount: approval.signatures.length,
      status: approval.status,
      error: approval.error,
    });
  } catch (err) {
    return Response.json(
      { error: `Failed to sign approval ${id}: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
