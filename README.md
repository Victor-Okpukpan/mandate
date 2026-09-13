# MANDATE

MANDATE turns ENS subnames into revocable spending mandates for AI agents, with Arc handling
where the money actually moves and Privy holding the keys that make it safe to do so.

An organization issues each of its AI agents an ENSv2 subname, non-transferable, self-expiring,
and instantly revocable. The subname's resolver records **are** the agent's authority: budget,
per-transaction cap, expiry, allowed recipients. The agent can read its own limits but is
cryptographically incapable of raising them. Contracts on Arc read that authority and enforce it
on every payment. Revoke the ENS subname and the agent's next payment dies mid-flight.

**MANDATE does not run your agent.** It issues and enforces the authority layer only: the ENS
record, the provisioned wallet, the on-chain anchor. The agent itself is whatever you already run,
an LLM loop, a cron job, your own stack. Bring your own agent; this is the seatbelt.

Built for ETHOnline 2026, targeting **ENS** (Best Use of ENSv2), **Arc** (Best Agentic Economy +
Best DeFi Stablecoin-Native Pool), and **Privy** (Best B2B Financial Product + Best Financial
Flow).

- **Landing / pitch:** runmandate.xyz
- **The app:** app.runmandate.xyz, self-serve org onboarding and the mandate dashboard
- **Docs:** runmandate.xyz/docs

## How it works, end to end

1. **An org registers.** Connect a wallet, pick a name (e.g. `acme.eth`), and the app runs the
   whole ENSv2 registration and Arc vault deployment through one guided flow. No script, no manual
   deploy per organization.
2. **An agent is registered.** Name it (`researcher.acme.eth`), set a budget, a per-transaction
   cap, an expiry, and the addresses it may pay. A real wallet is provisioned for it automatically
   in the same step, and its mandate is written to Sepolia as ENS text records.
3. **The Enforcer picks it up.** A background service mirrors the mandate's terms onto Arc, so the
   money-plane check has something real to compare every payment against.
4. **The agent spends.** Whatever is holding that wallet calls the treasury directly. Nothing
   pre-checks the call; the contract enforces its own rules (cap, allowlist, revoked flag,
   decaying budget) and reverts if they're violated.
5. **The org revokes it.** One transaction. The Enforcer mirrors the revocation onto Arc, and the
   agent's very next payment, even one that was valid a second earlier, reverts on-chain.

## What each piece does, and where

### ENS (ENSv2, Sepolia): the agent's authority
Every organization is a real ENSv2 name, and every agent it registers is a subname of it. An
agent's entire spending authority, its budget, per-transaction cap, allowed recipients, and
expiry, lives as plain, public text records on that subname, written the moment the org registers
it in the dashboard. Nothing about a mandate is private to this app: any counterparty can resolve
an agent's name and check its authority before doing business with it. An agent can delegate a
strictly narrower mandate to a sub-agent it hires, but it can never write to its own terms.

### Privy: wallet custody
The instant an agent is registered, Privy provisions it a real embedded wallet automatically,
no separate step, no human ever holding or seeing the key. That wallet is what actually signs
every payment the agent makes. Org admins also sign in through Privy, by email, with no wallet or
seed phrase required on their side either.

### Arc: where the money moves
Each organization gets its own pair of contracts on Arc, deployed alongside its ENS registration.
One tracks the mandate's terms and whether it's still live; the other holds the organization's
USDC and is the actual path every payment takes. Every payment is checked against the mandate on
the spot, and USDC is both the payment currency and the network's own gas token.

### The Enforcer: keeping Sepolia and Arc in sync
A long-lived background service that bridges the authority plane (Sepolia) and the money plane
(Arc). It watches every organization's mandates for changes and mirrors each one onto Arc within
moments of it happening on Sepolia, and sends a steady heartbeat so an agent's spending authority
never goes stale and gets frozen out by mistake. It runs continuously on a Tencent Cloud VPS as a
systemd service, restarting itself automatically if it ever crashes, and needs no restart when a
brand-new organization signs up.

## The SDK

[`mandate-agent-sdk`](https://www.npmjs.com/package/mandate-agent-sdk) is how an existing agent,
of any kind, connects to a mandate MANDATE has already issued it. It's published on npm,
framework-agnostic, and has no dependency on this repository or on any particular LLM. Its source
lives in `packages/agent-sdk/`:

```bash
npm install mandate-agent-sdk
```

An agent connects with a scoped credential from its own mandate's "Connect your agent" panel,
never the platform's own wallet-provider credentials, and gets back a handful of plain functions:
read its mandate's live terms, check its treasury balance, and pay. Every payment attempt is real;
the SDK doesn't pre-check anything, so the report it gives back, success or a specific on-chain
rejection reason, is exactly what the contract itself decided. An optional adapter wraps the same
calls for Anthropic's Tool Runner, for an agent built on Claude specifically, but it's a
convenience layer, not a requirement.

## Try it yourself

[`mandate-agent-demo`](https://github.com/Victor-Okpukpan/mandate-agent-demo) is a small,
standalone example: install `mandate-agent-sdk` from npm, point it at a real mandate, and type a
payment instruction in plain English. Claude decides whether to attempt it, and reports back
exactly what happened, including the real, decoded reason if the mandate refuses it.

## Architecture

Three planes, one source of truth: identity and permissions on Ethereum, money on a chain built
for it.

| Plane | Chain | What lives there |
|---|---|---|
| Authority | Sepolia (ENSv2) | Every organization and every agent's mandate, as an ENS name |
| Enforcement | Off-chain | The Enforcer, mirroring authority from Sepolia onto Arc |
| Money | Arc testnet | The checked spend path and the organization's pooled funds |

Full known-limitations list at `/docs/security`; deferred scope (agent-to-agent jobs,
sub-delegation in the dashboard, quorum onboarding) at `/docs/roadmap`.

## Deployed addresses

| Contract | Chain | Address |
| --- | --- | --- |
| `MandateOrgFactory` | Sepolia (11155111) | [`0x0CBD5A86640C86860F87A4058879FD19d79B22F7`](https://sourcify.dev/#/lookup/0x0CBD5A86640C86860F87A4058879FD19d79B22F7) |
| `ArcVaultFactory` | Arc testnet (5042002) | [`0xcF409d76298b7A63F2F2AC9171F58894BEf5894C`](https://testnet.arcscan.app/address/0xcF409d76298b7A63F2F2AC9171F58894BEf5894C?tab=contract) |

`MandateOrgFactory`'s source is verified on Sourcify (exact match).

Every organization's own registrar (Sepolia) and vault (Arc) are deployed by the two factories
above at onboarding time, and read live from the factories' own on-chain state rather than
hard-coded anywhere. There's deliberately no single "the" registrar or vault address; open the
app and create one.

## Standards

Solidity follows Cyfrin's solskill conventions: custom errors, strict pragma on contracts,
branching-tree tests, `forge fmt`/`solhint`/`aderyn`/`slither` clean. Every contract's NatSpec
carries an `@author` and a `@custom:security-contact`.

## License

MIT, see [`LICENSE`](./LICENSE). Copyright (c) 2026 Victor Okpukpan.
