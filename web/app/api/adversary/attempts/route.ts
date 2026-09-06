import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Reads the adversary agent's own escape-attempts log (`agents/adversary/src/escapeLog.ts`) — a
 * JSONL file it appends to locally, one line per raw-tool call it makes attacking its own mandate.
 * There is no IPC between that process and this one; this route works only when both run against
 * the same filesystem (true for the local/demo deployment this project ships as today) and reads
 * whatever is on disk at request time, nothing cached or aggregated server-side.
 *
 * Framing matters here, not just data: per mandate.md §12.3 and this file's own sibling
 * (`agents/adversary/src/escapeLog.ts`), a clean log proves nothing formally — it's an exploratory
 * fuzz over paths a human wouldn't think to try, not a substitute for the Foundry invariant suite.
 * `GET`'s response never says "secure"; the UI consuming it must not either.
 */
// turbopackIgnore: this path is genuinely outside the app directory (a sibling package's own log
// file) and configurable at runtime via ADVERSARY_LOG_PATH — Next's static file tracer otherwise
// bundles the entire monorepo into the server output trying to resolve it ahead of time.
const DEFAULT_LOG_PATH = resolve(/* turbopackIgnore: true */ process.cwd(), "../agents/adversary/escape-attempts.jsonl");

interface EscapeAttempt {
  timestamp: string;
  tool: string;
  succeeded: boolean;
  gate?: string;
  error?: string;
}

export async function GET() {
  const logPath = process.env.ADVERSARY_LOG_PATH
    ? resolve(/* turbopackIgnore: true */ process.cwd(), process.env.ADVERSARY_LOG_PATH)
    : DEFAULT_LOG_PATH;

  if (!existsSync(logPath)) {
    return Response.json({ available: false, total: 0, succeeded: 0, blocked: 0, recent: [] });
  }

  try {
    const attempts: EscapeAttempt[] = readFileSync(logPath, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as EscapeAttempt);

    const succeeded = attempts.filter((a) => a.succeeded).length;
    return Response.json({
      available: true,
      total: attempts.length,
      succeeded,
      blocked: attempts.length - succeeded,
      recent: attempts.slice(-5).reverse(),
    });
  } catch (err) {
    return Response.json(
      { available: false, error: err instanceof Error ? err.message : String(err), total: 0, succeeded: 0, blocked: 0, recent: [] },
      { status: 200 },
    );
  }
}
