import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

/**
 * Next only loads env files from this directory. Server-only secrets (`PRIVY_APP_SECRET` and
 * friends) live in the monorepo-root `.env` — shared with the contracts, the enforcer, and the
 * agents — and must never go in `web/.env.local`, which is committed-adjacent and NEXT_PUBLIC-only.
 * This pulls the root `.env` into `process.env` for the dev/build process, without overriding
 * anything already set (real environment vars and `web/.env.local` still win).
 */
function loadRootEnv() {
  try {
    const raw = readFileSync(join(process.cwd(), "..", ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1]!;
      if (process.env[key] !== undefined) continue;
      const value = (m[2] ?? "").replace(/^["']|["']$/g, "").trim();
      if (value) process.env[key] = value;
    }
  } catch {
    // No root .env (e.g. Vercel, where vars come from the dashboard) — nothing to do.
  }
}
loadRootEnv();

const nextConfig: NextConfig = {
  transpilePackages: ["@mandate/ui", "@mandate/shared"],
  reactStrictMode: true,
};

export default nextConfig;
