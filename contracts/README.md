# MANDATE contracts

Foundry project. Three contracts, composed against real ENSv2 (Sepolia) and Arc testnet
deployments — see the repo root README for the full picture.

```
src/
  MandateRegistrar.sol   Sepolia — issues, attenuates, amends, revokes mandates as ENS subnames
  MandateAnchor.sol      Arc     — the Enforcer's signed shadow of ENS state; assertSpend gate
  AgentTreasury.sol      Arc     — the credit facility agents draw, spend, and repay against
  interfaces/            thin interfaces onto contracts we compose, never rewrite
  libraries/             ENS role constants (mirrors the real ENSv2 source, not the docs site),
                          the on-chain DNS-name builder, and the leaky-bucket budget math
```

## Build & test

```bash
forge build --sizes
forge test -vvv
forge test --fork-url https://ethereum-sepolia-rpc.publicnode.com --match-path 'test/fork/*' -vvv
```

Fork tests run against the real ENSv2 beta deployment — no mocks for anything ENS-shaped. Mocks
would agree with our assumptions instead of contradicting them, which is exactly the failure mode
a beta-software integration needs to catch early.

## Deploying

Every deploy script uses `forge script <path> --account $ACCOUNT --sender $SENDER` against
Foundry's encrypted keystore. A private key never appears in plaintext anywhere in this repo,
including `.env` — the sole exception is a default Anvil test key for local development, and it
is always explicitly marked as such where used.

```bash
cast wallet import mandate-deployer --interactive   # once, per machine
forge script script/DeploySepolia.s.sol --account mandate-deployer --sender <address> --broadcast
```

Admin-facing contracts (`MandateAnchor.setEnforcer`, `AgentTreasury`'s owner) use `Ownable2Step`.
On mainnet that admin must be a multisig from the first deployment — a deployer EOA is a testnet-only
convenience, and every place we do it is commented as such.

## Standards

Cyfrin's solskill conventions throughout: custom errors prefixed `ContractName__`, strict pragma
`0.8.34` on contracts (0.8.28–0.8.33 carry a transient-storage IR bug), branching-tree `.tree`
files alongside fuzz/invariant tests, `forge fmt` + `solhint` + `slither`/`aderyn` in CI.
