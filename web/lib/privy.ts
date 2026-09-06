import "server-only";
import { PrivyClient } from "@privy-io/node";

/**
 * The one place `PRIVY_APP_SECRET` is ever read. Every `web/app/api/**` route imports this
 * instead of constructing its own `PrivyClient` — the app secret must never reach a client
 * bundle, and `server-only` makes an accidental client-side import a build error rather than a
 * runtime leak.
 */
function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in the repo root .env (not web/.env.local — that file is for ` +
        `NEXT_PUBLIC_* values only) and restart the dev server.`,
    );
  }
  return value;
}

let cached: PrivyClient | undefined;

/** Lazily constructed so a route file can import this module without throwing at build time in
 *  an environment that hasn't configured Privy yet — the throw happens on first real use, from
 *  inside the route handler, where it can be turned into a clean 503 instead of a build failure. */
export function getPrivyServerClient(): PrivyClient {
  if (cached) return cached;
  const appId = requireServerEnv("PRIVY_APP_ID");
  const appSecret = requireServerEnv("PRIVY_APP_SECRET");
  // @privy-io/node's PrivyClient has no constructor-level authorization-key option — a
  // quorum-signed write now takes a per-call `authorization_context` instead. Nothing in this
  // app currently makes such a write (see enforcer/src/index.ts's matching note).
  cached = new PrivyClient({ appId, appSecret });
  return cached;
}

export class PrivyNotConfiguredError extends Error {
  constructor(missing: string) {
    super(`Privy is not configured: ${missing} is not set.`);
    this.name = "PrivyNotConfiguredError";
  }
}

export class UnauthorizedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "UnauthorizedError";
  }
}

/**
 * Verifies the caller's Privy access token (sent as `Authorization: Bearer <token>`, obtained
 * client-side via `usePrivy().getAccessToken()`) before any route touches the wallet or policy
 * API. Every route in `web/app/api/**` calls this first — there is no route that trusts a bare
 * request. Throws `UnauthorizedError` on a missing/invalid token; callers turn that into a 401.
 *
 * `verifyAccessToken` here is the facade's own wrapper (`client.utils().auth()`), which manages
 * fetching and caching the app's JWKS internally — unlike the standalone `verifyAccessToken`
 * function this package also exports, which takes an explicit `verification_key` the caller
 * would otherwise have to fetch and cache by hand via `client.apps().get(appId)`.
 */
export async function requireAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!token) throw new UnauthorizedError("Missing Authorization: Bearer <access token> header.");

  try {
    return await getPrivyServerClient().utils().auth().verifyAccessToken(token);
  } catch (err) {
    throw new UnauthorizedError(
      `Access token failed verification: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
