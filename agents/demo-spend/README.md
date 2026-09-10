# demo-spend

The demo "agent". No LLM — it holds an agent wallet and makes one real
`AgentTreasury.payTo` call, then reports whether the chain let it through.

## Why

To show, live, that the mandate is enforced: a payment within limits lands, one
over budget reverts, and after the ENS name is revoked every payment reverts.
The enforcement is the treasury contract and the Arc anchor, not this script —
this script deliberately does no pre-checks.

## Setup

Set in the repo `.env` (or the shell):

| var | value |
|-----|-------|
| `AGENT_ENS_NAME` | the agent's mandate, e.g. `researcher.acme.eth` |
| `SEPOLIA_MANDATE_REGISTRAR` | the org's registrar (from its `OrgCreated` event) |
| `ARC_AGENT_TREASURY` | the org's treasury (from its `VaultCreated` event) |
| `ARC_MANDATE_ANCHOR` | the org's anchor |
| `AGENT_PRIVY_WALLET_ID` + `AGENT_ARC_WALLET_ADDRESS` | the agent's Privy wallet |
| `PRIVY_APP_ID` + `PRIVY_APP_SECRET` | server credentials |
| `SEPOLIA_RPC_URL`, `ARC_RPC_URL` | RPCs |

The agent wallet needs a little Arc-testnet native USDC for gas, and the
treasury needs a USDC balance (fund it from the dashboard).

## Run

```bash
cd agents/demo-spend

pnpm spend 5            # within cap, allowlisted recipient → lands
pnpm spend 5000         # over budget → reverts
pnpm spend 5 0xNotOnTheAllowlist…   # wrong recipient → reverts

# then revoke the mandate in the app and:
pnpm spend 5            # reverts — the agent is dead
```
