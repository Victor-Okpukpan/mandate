# MANDATE agent runtimes

Three layers, per mandate.md §12 — they do different jobs and aren't substitutes for each other.

```
shared/       Tool surface + chain/signer wiring, shared by every mandated agent
mandated/     One runtime, parameterized by role (research / scraper / vendor)
adversary/    The red-team agent — deliberately different SDK, see below
```

## Why two different SDKs

`mandated/` runs on `@anthropic-ai/sdk`'s Tool Runner
(`client.beta.messages.toolRunner` — camelCase in the real SDK), which exposes only the tools
explicitly defined in `shared/src/tools.ts`. A mandated agent should be structurally unable to
shell out or reach around its own mandate; the Tool Runner makes that true by construction rather
than by convention.

`adversary/` runs on the batteries-included `@anthropic-ai/claude-agent-sdk` instead —
deliberately, so it has `Bash` and file read and can study `contracts/src/*.sol` before attacking
them. Same underlying model, opposite tool philosophy, on purpose.

## The two rules that decide whether this is real or theatre

1. **Never put the budget in the system prompt.** Every mandated agent's persona
   (`mandated/src/roles.ts`) describes role and behavior only. `read_my_mandate()` resolves the
   agent's own ENS name and returns its actual, current terms — live, every call. An agent told
   its budget is following instructions; an agent that reads its budget is a namespace citizen.
2. **Do not pre-filter in the tool layer.** `shared/src/tools.ts`'s `pay`, `createJob`, and
   `issueSubmandate` call the real contracts directly and let them revert. No tool here
   pre-computes "is this within budget" before sending — that's `AgentTreasury`'s and
   `MandateAnchor`'s job. Demoing a local pre-check would be demoing TypeScript, not the
   enforcement.

## Running

Needs `ANTHROPIC_API_KEY`, a deployed `MandateRegistrar`/`MandateAnchor`/`AgentTreasury`, and
either a Privy wallet (`PRIVY_APP_ID`/`PRIVY_APP_SECRET`/`AGENT_PRIVY_WALLET_ID`) or — Anvil/local
testing only, never a real network — `AGENT_DEV_PRIVATE_KEY_ANVIL_ONLY`.

```bash
cd mandated && AGENT_ROLE=research AGENT_ENS_NAME=research.acme.eth \
  AGENT_TASK="Find a provider for a competitive-landscape report" pnpm dev

cd ../adversary && AGENT_ENS_NAME=research.acme.eth pnpm dev
```

## On the adversarial agent's epistemics

Stated plainly, not left implicit: **an adversarial agent finding nothing proves nothing
formally.** The Foundry fuzz/invariant suite in `contracts/test/` is the actual proof — INV-1
through INV-9 in `contracts/test/Attenuation.t.sol` and `AnchorStaleness.t.sol`. The adversary
agent is a demonstration and an exploratory fuzzer over paths a human tester wouldn't think to try,
nothing more. An "escape attempts: 214 · succeeded: 0" panel is genuinely useful for a demo — it
just isn't a security guarantee, and presenting it as one is exactly the overclaim a sharp judge
would catch.
