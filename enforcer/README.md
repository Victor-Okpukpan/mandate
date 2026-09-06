# MANDATE Enforcer

One process, every org. `orgSupervisor.ts` watches `MandateOrgFactory` (Sepolia) and
`ArcVaultFactory` (Arc) for `OrgCreated`/`VaultCreated`, and starts one registrar watcher + one
heartbeat loop per org it can verify — no restart needed when a new org is created through the
onboarding wizard, since that's the entire point of self-serve onboarding (HOW-IT-WORKS.md §4).
Each watcher propagates its org's issuances, amendments, and revocations into two independent
enforcement points: a Privy conditional policy, and a signed `MandateAnchor.syncMandate` call on
Arc. A propagator, not an authority — every write is EIP-712 signed and independently reproducible
from the Sepolia state it mirrors. See [`ARCHITECTURE.md`](../ARCHITECTURE.md) for the full
three-plane picture.

Falls back to watching a single hard-coded registrar/anchor/treasury
(`SEPOLIA_MANDATE_REGISTRAR`/`ARC_MANDATE_ANCHOR`/`ARC_AGENT_TREASURY`) when
`SEPOLIA_MANDATE_ORG_FACTORY`/`ARC_VAULT_FACTORY` aren't set — this is what a pre-factory
deployment still runs unmodified.

## Running

```bash
pnpm install
cp ../.env.example ../.env   # fill in the Enforcer + Privy sections
pnpm dev
```

Requires a Privy app (`PRIVY_APP_ID`/`PRIVY_APP_SECRET`) and the Enforcer's own signing key as an
encrypted V3 keystore (`ENFORCER_KEYSTORE_PATH`/`ENFORCER_KEYSTORE_PASSWORD`). Plus either:

- **Multi-org (recommended):** `SEPOLIA_MANDATE_ORG_FACTORY` and `ARC_VAULT_FACTORY` set, once
  `DeployFactories.s.sol` has run. Every org that factory pair has created is discovered
  automatically — see `orgSupervisor.ts`.
- **Single-org fallback:** `SEPOLIA_MANDATE_REGISTRAR`/`ARC_MANDATE_ANCHOR`/`ARC_AGENT_TREASURY`
  set instead.

Either way, this key must match the address each org's `MandateAnchor` was deployed with as
`initialEnforcer` (or `createVault`'s `enforcer` argument), or `syncMandate` will revert with
`MandateAnchor__InvalidSignature` on every call. For multi-org, `orgSupervisor.ts` checks this
itself before starting a watcher — an org whose anchor names a different enforcer, or whose
registrar and anchor owners don't match, is skipped and logged rather than crashing the process.

```bash
# Generate a keystore for a fresh key (or import an existing one) with cast:
cast wallet new-mnemonic   # or: cast wallet import mandate-enforcer --interactive
```

## What it does, in order

1. **Discover.** Multi-org: backfills `OrgCreated`/`VaultCreated` from both factories, joins them
   by `orgRootNode`, and verifies each org's registrar owner matches its anchor owner and that
   this Enforcer is the anchor's registered signer, before starting anything for it. Single-org:
   skips straight to step 2 against the one hard-coded registrar.
2. **Backfill.** Per org, reads every `MandateIssued`/`MandateAmended`/`MandateRevoked` log its
   registrar has ever emitted, oldest first, and syncs each one.
3. **Watch.** Subscribes to the same three events going forward via `watchContractEvent` — plus,
   in multi-org mode, to both factories' own creation events, so a wizard-onboarded org gets its
   own watcher without restarting this process.
4. **Per event:** reads the mandate's current terms, `mandateHash`, and `mandate.allow.human` from
   Sepolia, signs and submits a `SyncPayload` to `MandateAnchor` (nonce seeded from that org's own
   on-chain value on first use — scoped per watcher instance, never a single map shared across
   orgs, since nonces are per-`(anchor, agent)` not per-agent alone), and resolves the agent's
   Privy server wallet via a shared, TTL-cached `walletApi.getWallets()` lookup (address → wallet
   id, live — no local file to keep in sync, and shared across every org this process watches
   rather than refetched per sync) to sync or revoke its policy: a live mandate gets one `ALLOW`
   rule ANDing the treasury address, the per-tx cap, and the recipient allowlist, then `DENY *`; a
   revoked one gets rewritten straight to `DENY *` — the kill switch's off-chain half, independent
   of the on-chain anchor flip.
5. **Heartbeat.** Per org, every `MAX_STALENESS_SECONDS / 3`, signs and submits a short-lived
   heartbeat for every currently-live agent, so `assertSpend`'s fail-closed staleness check never
   trips on a healthy Enforcer.

## Provisioning

An agent needs a Privy server wallet before its mandate can be synced — the web app's
`POST /api/agents/provision` route creates one (`walletApi.createWallet`) and returns its address,
which becomes the mandate's `agentWallet`/`arcWallet` at issuance. This Enforcer only ever *finds*
wallets via `getWallets()`; it never creates one. A mandate synced before its wallet exists just
logs a warning and is retried on the next event for that node — nothing is lost, since the
Enforcer's own backfill re-reads the registrar's full history on every restart.
