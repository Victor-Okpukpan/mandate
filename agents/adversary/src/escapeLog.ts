import { appendFileSync, readFileSync, existsSync } from "node:fs";

export interface EscapeAttempt {
  timestamp: string;
  tool: string;
  input: unknown;
  succeeded: boolean;
  gate?: string;
  error?: string;
}

/**
 * Every raw-tool call this agent makes, logged regardless of outcome. Two payoffs beyond testing,
 * per mandate.md §12.3: an exploratory fuzz over paths a human wouldn't think to try, and an
 * "escape attempts: N · succeeded: 0" panel that's the cheapest high-impact demo element in the
 * project. Neither payoff is a formal guarantee — see this file's own README section on epistemics.
 */
export function logAttempt(logPath: string, attempt: EscapeAttempt) {
  appendFileSync(logPath, JSON.stringify(attempt) + "\n");
}

export function readAttempts(logPath: string): EscapeAttempt[] {
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EscapeAttempt);
}

export function summarize(attempts: EscapeAttempt[]) {
  const succeeded = attempts.filter((a) => a.succeeded).length;
  return { total: attempts.length, succeeded, blocked: attempts.length - succeeded };
}
