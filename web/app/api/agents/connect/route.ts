import { createPublicClient, http, namehash, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { MandateRegistrarAbi } from "@mandate/shared/abis";
import { getPrivyServerClient, requireAuthenticatedUser, UnauthorizedError } from "../../../../lib/privy";
import { issueAgentToken } from "../../../../lib/agentToken";

/**
 * Issues a scoped connection token for exactly one agent wallet — the thing that lets an org
 * admin's own agent process pay through `mandate-agent-sdk` without ever holding this platform's
 * `PRIVY_APP_SECRET` (which controls every wallet on the whole platform, not just theirs).
 *
 * The wallet the token names is never taken from the request — it's read live from the registrar
 * itself (`getMandate(node).agentWallet`), so a caller can't request a token for some other org's
 * wallet by supplying an arbitrary address. Authorization is the same boundary the UI already
 * enforces client-side (`useIsOrgAdmin`): the caller's own linked wallet must be
 * `registrar.owner()` for the org this mandate belongs to, checked here server-side instead of
 * trusted from the client.
 */
export async function POST(request: Request) {
  let claims;
  try {
    claims = await requireAuthenticatedUser(request);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const body = await request.json().catch(() => null);
  const registrar = body?.registrar as Address | undefined;
  const ensName = body?.ensName as string | undefined;
  if (!registrar || !ensName) {
    return Response.json({ error: "Missing registrar or ensName." }, { status: 400 });
  }

  const client = getPrivyServerClient();

  // The caller's own linked wallet address(es) — `verifyAccessToken` only returns a user id, so a
  // follow-up lookup is required to find what address it actually controls.
  const user = await client.users()._get(claims.user_id);
  const callerAddresses = new Set(
    user.linked_accounts
      .map((a) => ("address" in a ? (a as { address?: string }).address : undefined))
      .filter((a): a is string => Boolean(a))
      .map((a) => a.toLowerCase()),
  );

  const rpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
  const sepoliaClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

  const owner = await sepoliaClient.readContract({
    address: registrar,
    abi: MandateRegistrarAbi,
    functionName: "owner",
  });
  if (!callerAddresses.has(owner.toLowerCase())) {
    return Response.json({ error: "Only this organisation's admin can connect this agent." }, { status: 403 });
  }

  const node = namehash(ensName) as Hex;
  const mandate = await sepoliaClient.readContract({
    address: registrar,
    abi: MandateRegistrarAbi,
    functionName: "getMandate",
    args: [node],
  });
  if (!mandate.exists) {
    return Response.json({ error: `No mandate found for ${ensName}.` }, { status: 404 });
  }

  let wallet;
  try {
    wallet = await client.wallets().getWalletByAddress({ address: mandate.agentWallet });
  } catch {
    return Response.json(
      { error: `No Privy wallet found for ${mandate.agentWallet} — it wasn't provisioned through this app.` },
      { status: 404 },
    );
  }

  const token = issueAgentToken({ walletId: wallet.id, address: mandate.agentWallet, ensName });
  return Response.json({ token, address: mandate.agentWallet, walletId: wallet.id });
}
