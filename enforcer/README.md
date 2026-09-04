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
3. **Per event:** reads the mandate's current terms and `mandateHash` from Sepolia, signs and
   submits a `SyncPayload` to `MandateAnchor` (nonce seeded from the anchor's own on-chain value on
   first use, never assumed to start at 0 after a restart), and — for a live mandate — compiles and
   attaches a Privy conditional policy to the agent's wallet.
4. **Heartbeat.** Every `MAX_STALENESS_SECONDS / 3`, signs and submits a short-lived heartbeat for
   every currently-live agent, so `assertSpend`'s fail-closed staleness check never trips on a
   healthy Enforcer.

## Known gap

`walletRegistry.ts` maps an agent's on-chain address to its Privy wallet ID from a flat JSON file
— populated when an agent's Privy wallet is first provisioned (the agent runtime's job, `agents/`,
outside this service's scope). A deliberate, disclosed simplification for a single-Enforcer,
single-org deployment; swap for a real datastore before running more than one instance.
