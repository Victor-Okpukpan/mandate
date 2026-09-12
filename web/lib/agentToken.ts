import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Address } from "viem";

/**
 * Scoped connection tokens — the alternative to handing an external agent this app's own
 * `PRIVY_APP_SECRET`. That secret controls every wallet on the whole platform, every org, every
 * agent; an admin's own agent process should only ever be able to act as *its own* wallet. This
 * token is a plain HMAC-signed payload (no library, no new dependency) naming exactly one wallet —
 * `mandate-agent-sdk`'s `makeApiSigner` sends it to `/api/agents/relay`, which verifies the
 * signature, resolves the one wallet it names, and is the only place `PRIVY_APP_SECRET` is ever
 * used to actually sign. The token itself grants nothing beyond what that wallet's own mandate
 * already allows on-chain — a leaked token can only attempt payments `AgentTreasury`/`MandateAnchor`
 * would check anyway, same as a leaked signer inside the admin's own agent process would.
 */
export interface AgentTokenPayload {
  walletId: string;
  address: Address;
  /** Informational only, for display/debugging — not re-verified on relay. */
  ensName: string;
  iat: number;
}

function secret(): string {
  const s = process.env.AGENT_RELAY_TOKEN_SECRET;
  if (!s) {
    throw new Error(
      "Missing AGENT_RELAY_TOKEN_SECRET. Set it in the repo root .env — any long random string, " +
        "generated once per deployment (e.g. `openssl rand -hex 32`), never shared with Privy.",
    );
  }
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function issueAgentToken(payload: Omit<AgentTokenPayload, "iat">): string {
  const full: AgentTokenPayload = { ...payload, iat: Math.floor(Date.now() / 1000) };
  const body = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export class InvalidAgentTokenError extends Error {}

export function verifyAgentToken(token: string): AgentTokenPayload {
  const [body, mac] = token.split(".");
  if (!body || !mac) throw new InvalidAgentTokenError("Malformed token.");

  const expected = sign(body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new InvalidAgentTokenError("Signature mismatch.");
  }

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AgentTokenPayload;
  } catch {
    throw new InvalidAgentTokenError("Malformed payload.");
  }
}
