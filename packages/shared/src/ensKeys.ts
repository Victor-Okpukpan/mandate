/**
 * The ENS text-record namespace a mandate is written in (mandate.md §5.1). Two tiers, and the
 * split is the point: `mandate.*` is principal-writable only; `agent.*` is agent-writable, per-key,
 * via `authorizeTextRoles`. Never grant name-level ROLE_SET_TEXT — only these exact agent.* keys.
 */

/** Records the principal writes at issuance/amendment. The agent can read these, never write them. */
export const MANDATE_KEYS = {
  version: "mandate.v",
  principal: "mandate.principal",
  termsHash: "mandate.terms.hash",
  expires: "mandate.expires",
  budgetTotal: "mandate.budget.total",
  budgetPeriod: "mandate.budget.period",
  budgetPerTx: "mandate.budget.perTx",
  allowRoot: "mandate.allow.root",
  allowHuman: "mandate.allow.human",
  depth: "mandate.depth",
} as const;

/**
 * Records the agent itself is authorized to write, one `authorizeTextRoles` grant per key.
 * Never grant these as a name-level role — only per-key, and never grant any `mandate.*` key.
 */
export const AGENT_KEYS = {
  status: "agent.status",
  heartbeat: "agent.heartbeat",
  outputLast: "agent.output.last",
} as const;

/** Principal-written binding records — identity, not authority. Still under `mandate.*`'s tier. */
export const BINDING_KEYS = {
  arcWallet: "agent.arc.wallet",
  erc8004Id: "agent.erc8004.id",
  model: "agent.model",
} as const;

/** Every key an agent is permitted to write. `authorizeTextRoles` is called once per entry. */
export const AGENT_WRITABLE_KEYS: readonly string[] = Object.values(AGENT_KEYS);

export type AgentStatus = "idle" | "working" | "blocked";
