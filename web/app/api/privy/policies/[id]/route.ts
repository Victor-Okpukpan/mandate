import { getPrivyServerClient, requireAuthenticatedUser, UnauthorizedError } from "../../../../../lib/privy";

/**
 * Returns one policy's actual compiled rules — `policies().get(id)`. This is what makes
 * the Privy plane in the mandate drawer real instead of a placeholder: before this route existed,
 * the drawer had nowhere to read a policy from at all, and the enforcer had never successfully
 * created one anyway (see enforcer/src/privyPolicy.ts's rewrite notes). Requires the policy id in
 * hand — there is no `listPolicies` in the SDK, so the caller gets it from a wallet's own
 * `policyIds` (`GET /api/privy/wallets`).
 *
 * Conditions come back from the SDK as `field_source` (snake_case); translated to `fieldSource`
 * here so the drawer's rendering code (`usePrivyMandateStatus.ts`'s `PrivyPolicyRule`) never has
 * to know which Privy SDK version is behind this route.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuthenticatedUser(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;

  try {
    const policy = await getPrivyServerClient().policies().get(id);
    return Response.json({
      id: policy.id,
      name: policy.name,
      chainType: policy.chain_type,
      rules: policy.rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        action: rule.action,
        method: rule.method,
        conditions: rule.conditions.map((c) => ({
          fieldSource: c.field_source,
          field: c.field,
          operator: c.operator,
          value: c.value,
        })),
      })),
      createdAt: policy.created_at,
    });
  } catch (err) {
    return Response.json(
      { error: `Failed to read policy ${id}: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
