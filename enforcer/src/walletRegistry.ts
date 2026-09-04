import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { Address } from "viem";

/**
 * Maps an agent's on-chain wallet address to its Privy wallet ID. This mapping is created when an
 * agent's Privy server wallet is first provisioned (the agent runtime's job, `agents/` — outside
 * the Enforcer's scope) and only ever read here. A flat JSON file is a deliberate, honest
 * simplification for a hackathon-scope single-Enforcer deployment; swap for a real datastore
 * before running more than one Enforcer instance against the same org.
 */
export function loadWalletRegistry(path: string): Map<Address, string> {
  if (!existsSync(path)) return new Map();
  const raw = JSON.parse(readFileSync(path, "utf-8")) as Record<string, string>;
  return new Map(Object.entries(raw) as [Address, string][]);
}

export function saveWalletRegistry(path: string, registry: Map<Address, string>) {
  const raw = Object.fromEntries(registry);
  writeFileSync(path, JSON.stringify(raw, null, 2));
}
