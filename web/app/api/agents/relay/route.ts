import { createPublicClient, http, type Address, type Hex } from "viem";
import { arcTestnet } from "viem/chains";
import { makePrivySigner } from "mandate-agent-sdk";
import { getPrivyServerClient } from "../../../../lib/privy";
import { verifyAgentToken, InvalidAgentTokenError } from "../../../../lib/agentToken";

/**
 * The only place a request signed with a scoped agent token (`/api/agents/connect`) actually
 * reaches Privy. This is the one route that still uses `PRIVY_APP_SECRET` on an external caller's
 * behalf — but only ever for the single wallet the caller's token names, verified by signature,
 * never by anything the request body claims. `mandate-agent-sdk`'s `makeApiSigner` is the client
 * side of this — it POSTs here instead of calling Privy directly, so the SDK itself never needs
 * this app's Privy credentials at all.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body?.token as string | undefined;
  const chain = body?.chain as "sepolia" | "arc" | undefined;
  const to = body?.to as Address | undefined;
  const data = body?.data as Hex | undefined;
  const value = body?.value as string | undefined;

  if (!token || !chain || !to) {
    return Response.json({ error: "Missing token, chain, or to." }, { status: 400 });
  }
  if (chain !== "sepolia" && chain !== "arc") {
    return Response.json({ error: 'chain must be "sepolia" or "arc".' }, { status: 400 });
  }

  let payload;
  try {
    payload = verifyAgentToken(token);
  } catch (err) {
    if (err instanceof InvalidAgentTokenError) {
      return Response.json({ error: `Invalid token: ${err.message}` }, { status: 401 });
    }
    throw err;
  }

  const arcRpcUrl = process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
  const arcClient = createPublicClient({ chain: arcTestnet, transport: http(arcRpcUrl) });

  const signer = makePrivySigner(getPrivyServerClient(), payload.walletId, payload.address, arcClient);

  try {
    const hash = await signer.sendTransaction(chain, {
      to,
      data,
      value: value !== undefined ? BigInt(value) : undefined,
    });
    return Response.json({ hash });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
