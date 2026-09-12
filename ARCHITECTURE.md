# Architecture

Three planes, one source of truth. Identity and permissions belong on Ethereum, where they're
portable and legible to any counterparty. High-frequency machine payments belong on a chain where
gas is USDC and settlement is deterministic. The split is the design, not a limitation to work
around — see mandate.md's original framing, which this build holds to.

```mermaid
flowchart TB
  subgraph SEP["Sepolia — authority plane"]
    VF[VerifiableFactory] -->|deploys| UR[(Org UserRegistry)]
    MR[MandateRegistrar.sol] -->|issue / attenuate / amend / revoke| UR
    UR --> PR1[PermissionedResolver<br/>research.acme.eth]
    PR1 -.->|agent may write only<br/>agent.status, agent.heartbeat| A1
    SUB[(Agent sub-registry)] --> PR2[scraper.research.acme.eth]
    PR1 --- SUB
  end

  subgraph OFF["Off-chain — enforcement plane"]
    ENF[Enforcer service]
    PRIVY[(Privy Organization:<br/>server wallet custody)]
  end

  subgraph ARC["Arc testnet 5042002 — money plane"]
    MA[MandateAnchor.sol]
    AT[AgentTreasury.sol]
    JOBS[ERC-8183 Jobs]
    ID[ERC-8004 Identity + Reputation]
    AT -->|assertSpend| MA
    AT -->|payTo / fundJob| JOBS
  end

  UR -->|watches events| ENF
  ENF -->|EIP-712 signed syncMandate / heartbeat| MA
  A1[Agent runtime] -->|signs via| PRIVY
  A1 -->|payTo / fundJob| AT
  A1 --- ID
  WEB[Next.js observatory] --> SEP
  WEB --> ARC
  WEB --> PRIVY
```

## The three planes

**Authority (Sepolia).** `MandateRegistrar` deploys and owns its org's ENSv2 `UserRegistry` at
construction — self-contained, no external wiring step required beyond pointing the org's 2LD's
subregistry at it. Issuing a mandate:

1. Deploys a dedicated `PermissionedResolver` instance for that name.
2. Writes every `mandate.*` record inside the resolver's `initialize()` batch — atomic, one call.
3. Registers the name with a **zero registry-level role bitmap**: no `ROLE_CAN_TRANSFER_ADMIN`
   (soulbound), no `ROLE_RENEW` (self-expiring). Nothing to withhold later — admin roles are
   settable only at registration, so the bitmap has to be right the first time.
4. Grants the agent `authorizeTextRoles` on exactly three keys — `agent.status`,
   `agent.heartbeat`, `agent.output.last` — as **separate calls after deployment**, not inside the
   same `initialize()` batch. This is a real integration bug the Sepolia fork tests caught: the
   resolver's permission-check bypass during `initialize()` covers direct setters (`setText` et
   al.) but not the `authorizeTextRoles` grant path, and `multicall`'s delegatecall relay preserves
   the deploying `VerifiableFactory` as `msg.sender` throughout the whole init batch. Granting
   inside that batch would need the factory itself to hold admin rights — which nothing should
   ever grant it.

A sub-agent's mandate is created by `attenuate`, self-service by the parent's own agent wallet,
checked against the parent's *current* headroom (depth, expiry, per-tx cap, remaining budget) —
all narrow monotonically, enforced by the contract's own arithmetic. The allowlist root is
**inherited verbatim** rather than re-supplied: proving one merkle root is a subset of another
on-chain is expensive, so inheritance makes widening structurally impossible instead of merely
checked.

**Enforcement (off-chain).** The Enforcer watches Sepolia and propagates — never originates —
state into a signed `MandateAnchor.syncMandate` call on Arc. It is a propagator, not an authority:
every write is EIP-712 signed and independently reproducible from the Sepolia state it mirrors.
Revocation reuses the same `syncMandate` path with `revoked: true`, rather than a separate signing
scheme — one code path, the same nonce-monotonicity guarantee.

**Money (Arc).** `MandateAnchor.assertSpend` is the gate every payment passes through, checked in
order: revoked → expired → over the per-tx cap → recipient not allowlisted → **stale**. The last
one is deliberate and is the strongest security property in the system: a dead or censored
Enforcer freezes every agent instead of leaving them unsupervised. `AgentTreasury` is the org's
USDC pool, structured as a revolving credit facility — agents draw against it directly to pay a
counterparty (`payTo`) or fund an ERC-8183 job (`fundJob`), never routing pooled funds through
their own wallet. A leaky-bucket accumulator — not a fixed window — tracks the mandate's rolling
budget, decaying linearly rather than resetting on a timestamp boundary.

## Why the split is a feature

Privy's own stateful policies cap at roughly ten rolling-budget aggregations per app, can't
partition by wallet, and — by Privy's own documentation — update their aggregation values *after*
a request signs, not before, so concurrent spends can both pass. None of that is a criticism of
Privy; it's evidence for *why a chain is load-bearing here* rather than decorative: public
verifiability (a counterparty can resolve the mandate before accepting a job), scale (no
ten-aggregation ceiling), and correctness under concurrency (the on-chain ledger closes the race
Privy's own docs admit).

## Known limitations

Stated here, not discovered by a judge. Full detail at `/docs/security`.

- The Enforcer is a single off-chain service. It can only narrow or revoke a mandate — never widen
  one — but it is a liveness dependency: `assertSpend` fails closed once its staleness window
  elapses, freezing every agent rather than leaving them unsupervised.
- A sub-agent's allowlist is inherited verbatim from its parent, not independently choosable.
- Interest accrual (`AgentTreasury.accrue`) is simple, not compounding on a schedule — the first
  thing this design would cut under time pressure.
- `AgentTreasury.fundJob`'s call into the ERC-8183 reference Jobs contract was verified against its
  deployed selectors, not against an end-to-end call on live infrastructure — this build was kept
  independent of live credentials throughout.
- **Amending a mandate's `expiry`/`perTxCap` down does not cascade to its existing descendants.**
  `MandateRegistrar.amendMandate` re-validates the mandate being amended against its *own* parent's
  current terms, but never walks back down to already-issued children — there's no on-chain
  children index to walk (only a running `committed` sum), and adding one purely to support a
  retroactive tree-wide re-check was judged out of scope. Concretely: if `research.acme.eth` has
  perTxCap 100k and its child `scraper.research.acme.eth` attenuated to perTxCap 100k too, later
  tightening `research.acme.eth` to 10k does **not** touch `scraper`'s own stored 100k — it keeps
  spending at the old cap until someone re-amends or revokes it directly. `allowlistRoot` and a
  mandate's own `committed`-vs-`budgetTotal` ceiling *are* perpetually enforced on-chain (fixed
  after an invariant run caught both), but numeric narrowing is currently only a point-in-time
  check at attenuation/amendment, not a standing tree-wide guarantee. The fix belongs in the
  Enforcer, not the registrar: it already indexes every mandate's `parentNode` from `MandateIssued`
  logs to sync Arc, so it already has the full parent→children graph in memory — extending it to
  cascade-clamp a descendant's *effective* synced terms to `min(own terms, every live ancestor's
  current terms)` on any ancestor amendment is the same off-chain-ancestry mechanism this design
  already relies on for revocation, just applied to numbers instead of a boolean. Not yet built.
