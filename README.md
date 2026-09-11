# MANDATE

**ENS subnames are revocable spending mandates for AI agents. Arc is where they spend. Privy is
who holds the keys.**

An organization issues each of its AI agents an ENSv2 subname — non-transferable, self-expiring,
instantly revocable. The subname's resolver records **are** the agent's authority: budget, per-tx
cap, expiry, allowed recipients. The agent can read its own limits but is cryptographically
incapable of raising them. Two independent systems read that authority and enforce it —
a Privy wallet policy, off-chain, and `AgentTreasury`/`MandateAnchor` on Arc, on-chain. Revoke the
ENS subname and both die at once.

**MANDATE does not run your agent.** It issues and enforces the authority layer only — the ENS
record, the provisioned wallet, the synced policy. The agent itself is whatever you already run:
an LLM loop, a cron job, this repo's own example runtimes under `agents/`. Bring your own agent;
this is the seatbelt.

Built for ETHOnline 2026, targeting **ENS** (Best Use of ENSv2), **Arc** (Best Agentic Economy +
Best DeFi Stablecoin-Native Pool), and **Privy** (Best B2B Financial Product + Best Financial
Flow).

- **Landing / pitch:** `landing/` → runmandate.xyz
- **The app:** `web/` → app.runmandate.xyz — self-serve org onboarding, the mandate dashboard
- **Docs, per sponsor + roadmap:** `landing/app/docs/` → runmandate.xyz/docs

## How it works, end to end

1. **Create an org** — connect a wallet, pick a name (e.g. `acme.eth`), and the app runs the whole
   ENSv2 commit-reveal registration for you: commit → wait → approve + register → deploy the org's
   Arc vault (`MandateAnchor` + `AgentTreasury`) → register a first agent. One gated wizard,
   `web/app/onboard/`, backed by `MandateOrgFactory` (Sepolia) + `ArcVaultFactory` (Arc) so nothing
   is hand-run per org.
2. **Register an agent** — name it (`researcher.acme.eth`), set budget / per-tx cap / expiry /
   allowed recipients. The app provisions a real Privy server wallet for it (no human holds the
   key) and writes the terms as ENS text records via `MandateRegistrar.issueMandate`.
3. **The Enforcer picks it up** (`enforcer/`) — a long-lived process watching both factories, so a
   brand-new org needs no restart. For every mandate it finds, it (a) compiles a Privy policy from
   the mandate's terms and attaches it to the agent's wallet, and (b) signs and posts a matching
   record onto the Arc-side `MandateAnchor`.
4. **The agent spends** — whatever runtime is holding that wallet calls `AgentTreasury.payTo`.
   Nothing pre-checks the call; the contract just enforces its own rules (cap, allowlist, revoked
   flag, decaying budget) and reverts if they're violated. `agents/demo-spend` is a ~100-line,
   no-LLM stand-in that does exactly this, so the enforcement can be shown live without an API key
   or a reasoning loop in the way.
5. **Revoke** — one click on the dashboard calls `MandateRegistrar.revokeMandate`. The Enforcer
   mirrors it onto the anchor and collapses the Privy policy to a bare `DENY *`. The agent's very
   next payment — even one that was valid a second earlier — dies on both layers.

## What each sponsor technology actually does here

### ENS (ENSv2, Sepolia) — the authority plane
- Every org is a real ENSv2 name (`MandateOrgFactory` runs the commit-reveal `ETHRegistrar` flow
  for it); every agent is a subname of it, registered via a per-org `MandateRegistrar` deployed
  through `MandateRegistrarDeployer` (a separate deploy-helper contract — the registrar +
  factory logic doesn't fit EIP-170's 24KB limit in one deployment).
- A mandate's terms live as plain ENS text records on a `PermissionedResolver`, in two tiers:
  `mandate.*` (budget, cap, expiry, allowlist root — principal-writable only) and `agent.*`
  (status, heartbeat — writable by the agent itself, via a per-key `authorizeTextRoles` grant,
  never a name-level role). An agent can `attenuate` a strictly-narrower sub-mandate to a
  sub-agent; the registrar rejects anything that isn't strictly narrower in every dimension.
- Registration is paid for in a real ERC-20, not minted test tokens — see the Arc/USDC note below.

### Privy — wallet custody and the off-chain policy pre-filter
- **Server wallets**: every agent gets a real Privy embedded wallet (`wallets().create()`),
  provisioned by the app the moment an agent is registered — no human ever holds or sees the key.
- **Policies**: the Enforcer compiles each mandate's terms into a Privy conditional policy —
  one ALLOW rule (treasury address, `payTo.amount ≤ perTxCap`, `payTo.to ∈ allowlist`, all ANDed)
  over a `DENY *` default — and attaches it to the agent's wallet. Privy pre-filters the per-tx cap
  and the recipient allowlist before a transaction is even signed; the *cumulative* rolling budget
  is deliberately left to the on-chain layer instead (Privy's stateful aggregations can't partition
  per-wallet at the scale this needs).
- **Key quorums** (optional, `enforcer/scripts/setup-authorization-quorum.ts`): gives a wallet an
  `owner_id` so only a signed quorum — not just anyone holding the app secret — can alter it. Used
  by the org-admin approvals flow (`/org/[org]/approvals`), off by default.
- **The one real gap found and worked around**: Privy's Wallet API relay (`eth_sendTransaction`)
  authorizes chains per-app, and Arc testnet isn't on that list yet for this app — confirmed live
  (`401 App is not authorized to transact on chain eip155:5042002`), not a config mistake.
  `eth_signTransaction` sits on the other side of that gate (it never touches the network, so there
  is nothing for Privy to authorize) — `agents/shared/src/signer.ts` builds the Arc transaction
  itself, has Privy sign it, and broadcasts the raw bytes via Arc's own RPC. The private key never
  leaves Privy's custody; only the broadcast step moves. Drop this branch once Arc is added to
  Privy's relay allowlist.

### Arc — the money plane
- `MandateAnchor.sol` mirrors a mandate's terms on-chain (synced by the Enforcer) and tracks
  liveness/staleness; `AgentTreasury.sol` holds the org's USDC and is the actual spend path
  (`payTo`, `fundJob`) — a leaky-bucket budget that decays linearly rather than resetting on a
  fixed window, closing a double-spend-at-the-boundary hole the fixed-window version had.
- USDC is **both** Arc's native gas token (18dp) and an ordinary ERC-20 (6dp) at the same address —
  `packages/shared/src/decimals.ts` is the one place that conversion happens; nothing else inlines
  it.
- `ArcVaultFactory` deploys a `MandateAnchor` + `AgentTreasury` pair per org (`createVaultFor`),
  discovered by the app and the Enforcer alike via its `VaultCreated` events — no per-org script,
  no hard-coded address.
- ERC-8004 (identity + reputation) and ERC-8183 (jobs/escrow) are Arc-deployed sponsor contracts
  this project reads from (`/agent/[name]`'s identity-verification badge, the reputation score) and
  writes to (`AgentTreasury.createJob`/`fundJob`) — agent-to-agent commerce via jobs is built but
  deliberately not surfaced in the app's nav this version; see `/docs/roadmap`.
- **Real ENS registration payment**: Sepolia's `ETHRegistrar` prices registrations in USDC, not
  ETH, and its `paymentToken` allowlist was verified live (WETH and a random address both
  correctly rejected) to include Circle's actual Sepolia USDC — confirmed the platform's own choice
  by switching to it, over a project-specific mock token, so registration costs a real, widely-held
  token rather than one only this project's faucet could produce.

## Architecture

Three planes, one source of truth. Full writeup and diagram at
[`ARCHITECTURE.md`](./ARCHITECTURE.md) and `/docs/architecture`.

| Plane | Chain | What lives there |
|---|---|---|
| Authority | Sepolia (ENSv2) | `MandateOrgFactory`, `MandateRegistrar` — every org and mandate as an ENS name |
| Enforcement | Off-chain | The Enforcer — watches both factories, propagates into Privy + Arc |
| Money | Arc testnet | `ArcVaultFactory`, `MandateAnchor`, `AgentTreasury` — checked spend, credit facility |

## Repo layout

```
contracts/            Foundry — factories, MandateRegistrar, MandateAnchor, AgentTreasury (+ tests)
packages/shared/       ABIs, addresses, decimals/ENS-key/merkle/role/event helpers — TS
packages/ui/            Design tokens, type scale, shared React primitives
landing/                 Next.js — the pitch + per-sponsor docs + roadmap (runmandate.xyz)
web/                      Next.js — self-serve org onboarding + the mandate dashboard (app.runmandate.xyz)
enforcer/                 Off-chain service syncing ENS mandates to Privy + Arc — see enforcer/deploy/README.md to run it persistently
agents/                    Mandated agent runtimes, the no-LLM demo-spend script, and the adversarial red-team agent
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
# web/.env.local with just the NEXT_PUBLIC_* vars it actually reads, plus a next.config.ts hook
# that pulls server-only secrets (PRIVY_APP_SECRET etc.) from the root .env automatically.

# Contracts
cd contracts && forge build --sizes && forge test -vvv
forge test --fork-url https://ethereum-sepolia-rpc.publicnode.com --match-path 'test/fork/*' -vvv

# Frontends
cd ../landing && pnpm dev   # runmandate.xyz locally — needs no env file at all
cd ../web && pnpm dev        # app.runmandate.xyz locally
                               # NEXT_PUBLIC_MANDATE_ORG_FACTORY / NEXT_PUBLIC_ARC_VAULT_FACTORY
                               # already point at the live platform instance below — sign in and
                               # the onboarding wizard creates a real org against it.

# The demo agent — a real payment, allowed then blocked then killed, no LLM required
cd ../agents/demo-spend && pnpm spend 5   # see agents/demo-spend/README.md for the full sequence
```

No per-org script to run: every org, including the demo one, onboards through the same self-serve
wizard the app ships — `contracts/script/DeployFactories.s.sol` deploys the two platform factories
once, and everything after that is a button, not a script.

## Deployed addresses

Source-verified where noted — explorer links go straight to the readable contract.

| Contract | Chain | Address |
| --- | --- | --- |
| `MandateOrgFactory` | Sepolia (11155111) | [`0xC15F98e14860e34C2CCD1640a699329Cf7F35009`](https://sepolia.etherscan.io/address/0xC15F98e14860e34C2CCD1640a699329Cf7F35009) |
| `MandateRegistrarDeployer` | Sepolia (11155111) | [`0x0bd9De82616D74C791f1D421595E414cea43c05E`](https://sepolia.etherscan.io/address/0x0bd9De82616D74C791f1D421595E414cea43c05E) |
| `ArcVaultFactory` | Arc testnet (5042002) | [`0xcF409d76298b7A63F2F2AC9171F58894BEf5894C`](https://testnet.arcscan.app/address/0xcF409d76298b7A63F2F2AC9171F58894BEf5894C?tab=contract) |

Every org's own `MandateRegistrar` (Sepolia) and `MandateAnchor`/`AgentTreasury` pair (Arc) are
deployed by the two factories above at onboarding time — discovered live from `OrgCreated` /
`VaultCreated` events (`packages/shared/src/orgs.ts`), never hard-coded. There is deliberately no
single "the" registrar or vault address anymore; open the app and create one.

## Design decisions that diverge from the original spec

Found and fixed while implementing rather than left as known bugs — each documented in depth in
the relevant contract's own NatSpec and at `/docs/architecture`:

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
4. **Registration priced in Circle's real Sepolia USDC, not a project-minted mock.** Verified live
   that ENSv2's own `ETHRegistrar` payment-token allowlist accepts it alongside this project's
   now-retired `MockUSDC` — a deliberate choice for a token every Sepolia project already holds,
   not a workaround.
5. **Arc vault discovery reads `vaultsOfAdmin`/`vaults` by direct call, not `eth_getLogs`.** Arc's
   public RPC rejects log queries outright at ranges well under other chains' caps — found live as
   a real Enforcer crash, not anticipated. Both the app and the Enforcer read vaults this way now.
6. **Arc payments sign-then-broadcast instead of one-call `sendTransaction`.** See the Privy section
   above — a real, live-confirmed gap in Privy's per-app chain relay authorization, not a design
   choice; the workaround is isolated to `agents/shared/src/signer.ts` and reverts to the simpler
   path the moment Arc is added to that allowlist.

Full known-limitations list, honestly stated rather than left for a judge to find, at
`/docs/security`. Deferred scope (agent-to-agent jobs, sub-delegation UI, quorum onboarding as a
first-class step) at `/docs/roadmap`.

## Standards

Solidity follows Cyfrin's solskill conventions: custom errors, strict pragma on contracts, branching-tree
tests, `forge fmt`/`solhint`/`aderyn`/`slither` clean. Every contract's NatSpec carries an
`@author` and a `@custom:security-contact`. See [`contracts/README.md`](./contracts/README.md).

## License

MIT — see [`LICENSE`](./LICENSE). Copyright (c) 2026 Victor Okpukpan.
