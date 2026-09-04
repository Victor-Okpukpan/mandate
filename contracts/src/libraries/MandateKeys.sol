// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title MandateKeys
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice The ENS text-record namespace a mandate is written in. Mirrors
///         `packages/shared/src/ensKeys.ts` exactly — keep the two in sync.
/// @dev Two tiers, and the split is the point: `MANDATE_*` keys are principal-writable only;
///      `AGENT_*` keys are agent-writable, one `authorizeTextRoles` grant per key. Never grant
///      name-level `ROLE_SET_TEXT`, and never authorize the agent for any `mandate.*` key.
library MandateKeys {
    // --- mandate.* (agent CANNOT write these) ---
    string internal constant VERSION = "mandate.v";
    string internal constant PRINCIPAL = "mandate.principal";
    string internal constant TERMS_HASH = "mandate.terms.hash";
    string internal constant EXPIRES = "mandate.expires";
    string internal constant BUDGET_TOTAL = "mandate.budget.total";
    string internal constant BUDGET_PERIOD = "mandate.budget.period";
    string internal constant BUDGET_PER_TX = "mandate.budget.perTx";
    string internal constant ALLOW_ROOT = "mandate.allow.root";
    string internal constant ALLOW_HUMAN = "mandate.allow.human";
    string internal constant DEPTH = "mandate.depth";

    // --- agent.* (agent CAN write, per-key authorized) ---
    string internal constant STATUS = "agent.status";
    string internal constant HEARTBEAT = "agent.heartbeat";
    string internal constant OUTPUT_LAST = "agent.output.last";

    // --- binding (principal-written) ---
    string internal constant ARC_WALLET = "agent.arc.wallet";
    string internal constant ERC8004_ID = "agent.erc8004.id";
    string internal constant MODEL = "agent.model";
}
