# MANDATE

**ENS subnames are revocable powers of attorney for AI agents. Arc is where they spend.**

An organization issues each of its AI agents an ENSv2 subname that is non-transferable,
self-expiring, and instantly revocable. The subname's resolver records **are** the agent's
mandate — its budget, its allowlist, its expiry. The agent can read its own leash but is
cryptographically incapable of lengthening it. That mandate is anchored on Arc, so every payment
is checked against one source of truth. Revoke the ENS role and the agent's next payment dies
mid-flight.

Built for ETHOnline 2026, targeting **ENS** (Best Use of ENSv2), **Arc** (Best Agentic Economy +
Best DeFi Stablecoin-Native Pool), and **Privy** (Best B2B Financial Product + Best Financial
Flow).

- **Landing / pitch:** `landing/` → runmandate.xyz
- **Observatory (the app):** `web/` → app.runmandate.xyz
- **Docs, per sponsor:** `landing/app/docs/` → runmandate.xyz/docs

## Architecture

Three planes, one source of truth. Full writeup and diagram at
[`ARCHITECTURE.md`](./ARCHITECTURE.md) and `/docs/architecture`.

| Plane | Chain | What lives there |
|---|---|---|
| Authority | Sepolia (ENSv2) | `MandateRegistrar.sol` — every mandate as an ENS subname |
| Enforcement | Off-chain | The Enforcer — watches Sepolia, propagates into Privy + Arc |
| Money | Arc testnet | `MandateAnchor.sol`, `AgentTreasury.sol` — checked spend, credit facility |

## Repo layout

```
contracts/            Foundry — MandateRegistrar, MandateAnchor, AgentTreasury (+ tests)
packages/shared/       ABIs, addresses, decimals/ENS-key/merkle/role helpers — TS
packages/ui/            Design tokens, type scale, shared React primitives
landing/                 Next.js — the pitch + per-sponsor docs (runmandate.xyz)
web/                      Next.js — the observatory (app.runmandate.xyz)
enforcer/                 Off-chain service syncing ENS mandates to Privy + Arc (planned)
agents/                    Mandated agent runtimes + the adversarial red-team agent (planned)
```

## Running locally

Requires Node 20+, pnpm 9, Foundry.

```bash
git clone <this repo>
cd mandate
pnpm install
cp .env.example .env   # every value is a public default or empty — see the file's own comments
# Root .env covers the whole monorepo (contracts, enforcer, agents). Next.js only reads env files
# from its own app directory, so each frontend keeps its own small subset instead of the whole
# file: landing/ needs none (its two vars both have working fallbacks in code); web/ has its own
# web/.env.local with just the NEXT_PUBLIC_* vars it actually reads — update it by hand alongside
# the root .env whenever a deployed address changes.

# Contracts
cd contracts && forge build --sizes && forge test -vvv
forge test --fork-url https://ethereum-sepolia-rpc.publicnode.com --match-path 'test/fork/*' -vvv

# Frontends
cd ../landing && pnpm dev   # runmandate.xyz locally — needs no env file at all
cd ../web && pnpm dev        # app.runmandate.xyz locally — renders a "not yet deployed" state
                               # until web/.env.local's NEXT_PUBLIC_MANDATE_REGISTRAR etc. are set
```

Nothing in this repo has been deployed yet — every contract address in `.env.example` is either a
verified, public sponsor address (ENSv2 Sepolia, Arc's USDC/ERC-8004/ERC-8183) or left empty for
this project's own three contracts. The observatory is built to render correctly in both states:
live once deployed, an honest "not yet deployed" panel until then. See each route's own handling
in `web/app/`.

## Deployed addresses

Source-verified — explorer links go straight to the readable contract.

| Contract | Chain | Address | Verified via |
| --- | --- | --- | --- |
| `MandateRegistrar` | Sepolia (11155111) | [`0x1C941C121463e1Ce9ab6541FdBa484b79d1D128A`](https://sepolia.etherscan.io/address/0x1C941C121463e1Ce9ab6541FdBa484b79d1D128A) | [Sourcify](https://repo.sourcify.dev/contracts/full_match/11155111/0x1C941C121463e1Ce9ab6541FdBa484b79d1D128A/) |
| `MandateAnchor` | Arc testnet (5042002) | [`0x5c2C1eb9Dc9f88Ebf10d96A8e8e74F1437d022Be`](https://testnet.arcscan.app/address/0x5c2C1eb9Dc9f88Ebf10d96A8e8e74F1437d022Be?tab=contract) | Blockscout |
| `AgentTreasury` | Arc testnet (5042002) | [`0x1C941C121463e1Ce9ab6541FdBa484b79d1D128A`](https://testnet.arcscan.app/address/0x1C941C121463e1Ce9ab6541FdBa484b79d1D128A?tab=contract) | Blockscout |

`MandateRegistrar` is verified via Sourcify rather than Etherscan directly (no Etherscan API key
in this environment) — Etherscan mirrors Sourcify's full-match verifications for most chains
including Sepolia, so its own page should pick this up; the Sourcify link is the authoritative
source in the meantime.

Org root: `mandate.eth`, registered on ENSv2 Sepolia via `DeploySepolia.s.sol`.

## Design decisions that diverge from the original spec

Three, all found and fixed while implementing rather than left as known bugs — each documented in
depth in the relevant contract's own NatSpec and at `/docs/architecture`:

1. **Typed spend paths, not a generic executor.** `AgentTreasury.payTo`/`fundJob` replace a
   `(target, calldata)` executor whose merkle leaf never bound the recipient — an allowlisted
   `transfer` selector could have sent pooled USDC anywhere.
2. **A leaky-bucket budget, not a fixed window.** Decays linearly instead of resetting on a
   timestamp boundary, closing a double-spend-across-the-boundary hole and a divide-by-zero at
   `budgetPeriod == 0` (the spec's own documented "lifetime budget" case).
3. **Resolver permission grants run after deployment, not inside the same `initialize()` batch.**
   A real integration bug, caught by forking Sepolia: the resolver's permission-check bypass
   during `initialize()` covers direct setters, not the `authorize*Roles` grant path, because
   `multicall`'s delegatecall relay preserves the deploying factory as `msg.sender` throughout the
   whole batch.

Full known-limitations list, honestly stated rather than left for a judge to find, at
`/docs/security`.

## Standards

Solidity follows Cyfrin's solskill conventions: custom errors, strict pragma on contracts, branching-tree
tests, `forge fmt`/`solhint`/`aderyn`/`slither` clean. Every contract's NatSpec carries an
`@author` and a `@custom:security-contact`. See [`contracts/README.md`](./contracts/README.md).

## License

MIT — see [`LICENSE`](./LICENSE). Copyright (c) 2026 Victor Okpukpan.
