# MANDATE Enforcer

Watches `MandateRegistrar` on Sepolia and propagates every issuance, amendment, and revocation
into two independent enforcement points: a Privy conditional policy, and a signed
`MandateAnchor.syncMandate` call on Arc. A propagator, not an authority — every write is EIP-712
signed and independently reproducible from the Sepolia state it mirrors. See
[`ARCHITECTURE.md`](../ARCHITECTURE.md) for the full three-plane picture.

## Running

```bash
pnpm install
cp ../.env.example ../.env   # fill in the Enforcer + Privy sections
pnpm dev
```

Requires `MandateRegistrar` and `MandateAnchor` already deployed (`SEPOLIA_MANDATE_REGISTRAR`,
`ARC_MANDATE_ANCHOR`, `ARC_AGENT_TREASURY` set), a Privy app (`PRIVY_APP_ID`/`PRIVY_APP_SECRET`),
and the Enforcer's own signing key as an encrypted V3 keystore
(`ENFORCER_KEYSTORE_PATH`/`ENFORCER_KEYSTORE_PASSWORD`) — that key must match the address
`MandateAnchor` was deployed with as `initialEnforcer`, or `syncMandate` will revert with
`MandateAnchor__InvalidSignature` on every call.

```bash
# Generate a keystore for a fresh key (or import an existing one) with cast:
cast wallet new-mnemonic   # or: cast wallet import mandate-enforcer --interactive
```

## What it does, in order

1. **Backfill.** Reads every `MandateIssued`/`MandateAmended`/`MandateRevoked` log the registrar
   has ever emitted, oldest first, and syncs each one — so a fresh Enforcer instance catches up to
   the registrar's full history before going live.
2. **Watch.** Subscribes to the same three events going forward via `watchContractEvent`.
3. **Per event:** reads the mandate's current terms, `mandateHash`, and `mandate.allow.human` from
   Sepolia, signs and submits a `SyncPayload` to `MandateAnchor` (nonce seeded from the anchor's
   own on-chain value on first use, never assumed to start at 0 after a restart), and resolves the
   agent's Privy server wallet via `walletApi.getWallets()` (address → wallet id, live — no local
   file to keep in sync) to sync or revoke its policy: a live mandate gets one `ALLOW` rule ANDing
   the treasury address, the per-tx cap, and the recipient allowlist, then `DENY *`; a revoked one
   gets rewritten straight to `DENY *` — the kill switch's off-chain half, independent of the
   on-chain anchor flip.
4. **Heartbeat.** Every `MAX_STALENESS_SECONDS / 3`, signs and submits a short-lived heartbeat for
   every currently-live agent, so `assertSpend`'s fail-closed staleness check never trips on a
   healthy Enforcer.

## Provisioning

An agent needs a Privy server wallet before its mandate can be synced — the web app's
`POST /api/agents/provision` route creates one (`walletApi.createWallet`) and returns its address,
which becomes the mandate's `agentWallet`/`arcWallet` at issuance. This Enforcer only ever *finds*
wallets via `getWallets()`; it never creates one. A mandate synced before its wallet exists just
logs a warning and is retried on the next event for that node — nothing is lost, since the
Enforcer's own backfill re-reads the registrar's full history on every restart.
