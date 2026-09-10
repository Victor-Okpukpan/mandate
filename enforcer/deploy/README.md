# Running the Enforcer on a VPS

The Enforcer is a long-lived process — it watches Sepolia mandate events and propagates each one
into a Privy policy and a signed Arc anchor. Nothing about it is serverless; it must stay running,
or every mandate issued while it's down sits real on Sepolia with no enforcement mirrored to it
(see `landing/app/docs/page.tsx`'s own "Using the app" section, which discloses this gap directly).

This directory is the systemd path — the simplest option for a single small VPS (e.g. Tencent
Cloud Lighthouse/CVM), no Docker required.

## First deploy

```bash
# On the VPS, as a regular user:
git clone <this repo> /opt/mandate   # or scp/rsync it there
cd /opt/mandate

# As root:
sudo bash enforcer/deploy/setup.sh
```

`setup.sh` installs Node 20 + pnpm if missing, creates an unprivileged `mandate` system user,
installs workspace dependencies, and registers (but does not yet start) the systemd unit.

Then:

```bash
sudo cp .env.example /opt/mandate/.env
sudo vim /opt/mandate/.env   # fill in real values — see the var list below
sudo chown mandate:mandate /opt/mandate/.env
sudo chmod 600 /opt/mandate/.env

sudo systemctl enable --now mandate-enforcer
journalctl -u mandate-enforcer -f   # confirm it comes up clean
```

## What the Enforcer specifically needs in `.env`

Not the full 58-var list — just what `enforcer/src/config.ts` actually reads:

- `SEPOLIA_RPC_URL`, `ARC_RPC_URL`
- Signing key, one of:
  - `ENFORCER_KEYSTORE_PATH` + `ENFORCER_KEYSTORE_PASSWORD` (a Foundry-style encrypted V3
    keystore JSON — production path), or
  - `ENFORCER_DEV_PRIVATE_KEY_ANVIL_ONLY` (plaintext — Anvil/local only, never point this at a
    real key on a real network)
- `PRIVY_APP_ID`, `PRIVY_APP_SECRET`
- **The full ENSv2 + Arc sponsor address set** — `loadFactories()`/`loadSingleOrgFallback()` both
  call `getSepoliaAddresses()`/`getArcAddresses()` (`packages/shared/src/addresses.ts`), which
  `requireAddress()` every one of these, not just the org-specific ones below. All public, verified
  sponsor addresses (not secrets) — copy them straight from `.env.example`'s Sepolia/Arc sections:
  `SEPOLIA_ROOT_REGISTRY`, `SEPOLIA_ETH_REGISTRY`, `SEPOLIA_ETH_REGISTRAR`,
  `SEPOLIA_USER_REGISTRY_IMPL`, `SEPOLIA_PERMISSIONED_RESOLVER_IMPL`,
  `SEPOLIA_UNIVERSAL_RESOLVER_V2`, `SEPOLIA_VERIFIABLE_FACTORY`, `SEPOLIA_RENT_PRICE_ORACLE`,
  `SEPOLIA_USDC`, `ARC_USDC`, `ARC_ERC8004_IDENTITY`, `ARC_ERC8004_REPUTATION`,
  `ARC_ERC8004_VALIDATION`, `ARC_ERC8183_JOBS`. Easiest to just copy the whole `.env.example` and
  fill in the org/secret-specific lines below, rather than hand-picking a subset — this list was
  hand-picked once already and missed these.
- Either the single-org fallback (`SEPOLIA_MANDATE_REGISTRAR`, `ARC_MANDATE_ANCHOR`,
  `ARC_AGENT_TREASURY`) or, once deployed, the two factory addresses
  (`SEPOLIA_MANDATE_ORG_FACTORY`, `ARC_VAULT_FACTORY`) — `enforcer/src/config.ts`'s
  `loadFactories()`/`loadSingleOrgFallback()` decide which at startup.
- `ENFORCER_MAX_STALENESS_SECONDS` (optional, defaults to 900)
- `PRIVY_ENFORCER_AUTHORIZATION_KEY` (optional — see its own comment in `.env.example`)

## Redeploying after a code change

```bash
cd /opt/mandate && git pull
sudo -u mandate pnpm install --frozen-lockfile
sudo systemctl restart mandate-enforcer
```

## Operating notes

- **Logs**: `journalctl -u mandate-enforcer -f` (or `-n 200` for recent history).
- **The service auto-restarts** on crash (`Restart=always` in the unit), capped at 10 restarts per
  5 minutes so a genuine crash loop doesn't spin the CPU forever — check the logs if it stops
  restarting.
- **The systemd unit hardens the process** (`ProtectSystem=strict`, `NoNewPrivileges`,
  `PrivateTmp`) — it needs no write access anywhere at runtime, including its own keystore, which
  it only reads.
- **One Enforcer process can watch every org** — `enforcer/src/orgSupervisor.ts` discovers orgs
  from both factories' events and spawns one watcher per org inside the same process. You don't
  need one VPS per organisation.
