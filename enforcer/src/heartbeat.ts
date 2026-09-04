import type { Address } from "viem";
import { submitHeartbeat, type makeArcClients } from "./arcSync.js";
import { MAX_STALENESS_SECONDS } from "./config.js";

/**
 * Periodic keepalive for every currently-live agent — fires at a third of `MAX_STALENESS_SECONDS`
 * so a single missed tick still leaves margin before `assertSpend` starts failing closed. Each
 * heartbeat signature is itself short-lived (bounded by `MAX_STALENESS_SECONDS`, not indefinitely
 * replayable) — see MandateAnchor.sol's NatSpec on why that bound matters.
 */
export function startHeartbeatLoop(
  liveAgents: Set<Address>,
  arcClients: ReturnType<typeof makeArcClients>,
  anchorAddress: Address,
  intervalMs: number,
) {
  const tick = async () => {
    for (const agent of liveAgents) {
      try {
        const txHash = await submitHeartbeat(arcClients, anchorAddress, agent, MAX_STALENESS_SECONDS);
        console.log(`[heartbeat] ${agent} tx=${txHash}`);
      } catch (err) {
        console.error(`[heartbeat] failed for ${agent}:`, err);
      }
    }
  };

  const id = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(id);
}
