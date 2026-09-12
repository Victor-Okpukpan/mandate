# mandate-agent-sdk

The integration surface for "bring your own agent." An org admin creates a mandate on
[runmandate.xyz](https://runmandate.xyz) — budget, per-tx cap, allowlist, expiry, a real Privy
wallet. This package is how *your* agent — whatever it already is — reads that mandate and spends
against it. It has no opinion about which LLM, framework, or runtime you use, and no LLM dependency
at all in its core.

## Not yet published

This resolves today via the pnpm workspace (`workspace:*`) inside this monorepo, not from the
public npm registry — flip `private` to `false` in `package.json` and `npm publish` is the literal
next step, once `@mandate/shared` (the ABIs/addresses/decimals helpers this package depends on) is
either published alongside it or vendored in. Disclosed here rather than implied; see
[`/docs/roadmap`](https://runmandate.xyz/docs/roadmap).

## Core — framework-agnostic

```ts
import { connectMandate, makePrivySigner, makeChainClients } from "mandate-agent-sdk";
import { PrivyClient } from "@privy-io/node";

const privy = new PrivyClient({ appId: process.env.PRIVY_APP_ID!, appSecret: process.env.PRIVY_APP_SECRET! });

const mandate = connectMandate({
  ensName: "researcher.acme.eth",
  signer: makePrivySigner(privy, walletId, walletAddress, makeChainClients().arc),
});

// Read your own limits live — never hard-code them, they can change or be revoked.
const terms = await mandate.readMyMandate();
console.log(`budget: $${terms.budgetTotal}, per-tx cap: $${terms.perTxCap}`);

// Pay. This is the real spend path — it reverts on-chain if it violates the mandate. Nothing here
// pre-checks; the contract is the actual enforcement.
const tx = await mandate.pay("0x6375e286A9bDe6f1529f3a9895684F7178235a5c", "1.00");
```

Call `.readMyMandate()` / `.pay()` / `.checkTreasury()` / `.setStatus()` from wherever your agent
loop already lives — a LangChain tool, a raw OpenAI function-calling loop, a cron job, a plain
`while` loop. Nothing in this package cares.

### Signers

- `makePrivySigner(privy, walletId, address, arcClient)` — production path. The private key never
  leaves Privy's custody. `arcClient` is required for Arc sends: Arc isn't yet on Privy's per-app
  relay allowlist, so this signs the transaction with Privy and broadcasts the raw bytes itself
  (see the security docs) — pass a `PublicClient` for Arc, e.g. `makeChainClients().arc`.
- `makeDevSigner(privateKey, rpcUrls)` — Anvil/local testing only. Never point this at Sepolia or
  Arc testnet with a real key.

## Anthropic adapter (optional)

Already on Claude and want the Tool Runner schema written for you instead of calling the plain
methods above yourself:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { buildMandatedAgentTools, runMandatedAgent } from "mandate-agent-sdk/anthropic";

const tools = buildMandatedAgentTools({ ensName, clients, signer });
// or, to run one task to completion:
await runMandatedAgent(new Anthropic({ apiKey }), { ensName, clients, signer, systemPrompt }, task);
```

This is a thin, optional layer — it calls the exact same on-chain paths as the core, just wrapped
in Anthropic's tool-call schema. An OpenAI or LangChain equivalent would be the same shape: wrap the
core's plain methods in that framework's own tool-definition format.
