import { requireAuthenticatedUser, UnauthorizedError, getPrivyServerClient } from "../../../lib/privy";
import { listApprovals, proposeApproval, type ApprovalAction } from "../../../lib/approvals";

/**
 * Lists and proposes tier-gated actions. See `web/lib/approvals.ts` for why this exists instead
 * of Privy's own intent-authorize endpoint — the underlying execution mechanism is Privy's
 * documented, live-verified `authorization_context` direct-call signing, just wrapped in a
 * collect-until-threshold record so signers can act independently over time.
 */
export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: err.message }, { status: 401 });
    throw err;
  }

  const orgEnsName = new URL(request.url).searchParams.get("org");
  if (!orgEnsName) return Response.json({ error: "org query param required." }, { status: 400 });

  const approvals = listApprovals(orgEnsName).map((a) => ({
    id: a.id,
    action: a.action,
    threshold: a.threshold,
    signatureCount: a.signatures.length,
    status: a.status,
    error: a.error,
    createdAt: a.createdAt,
    createdBy: a.createdBy,
  }));
  return Response.json({ approvals });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ error: err.message }, { status: 401 });
    throw err;
  }

  const body = await request.json().catch(() => null);
  const orgEnsName = typeof body?.orgEnsName === "string" ? body.orgEnsName : undefined;
  const quorumId = typeof body?.quorumId === "string" ? body.quorumId : undefined;
  const action = body?.action as ApprovalAction | undefined;
  if (!orgEnsName || !quorumId || !action?.kind) {
    return Response.json({ error: "orgEnsName, quorumId, and action are required." }, { status: 400 });
  }

  try {
    const quorum = await getPrivyServerClient().keyQuorums().get(quorumId);
    const approval = proposeApproval({
      orgEnsName,
      quorumId,
      threshold: quorum.authorization_threshold ?? 1,
      action,
      createdBy: (user as { user_id?: string } | undefined)?.user_id ?? "unknown",
    });
    return Response.json({
      id: approval.id,
      threshold: approval.threshold,
      signatureCount: 0,
      status: approval.status,
    });
  } catch (err) {
    return Response.json(
      { error: `Failed to propose approval: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
