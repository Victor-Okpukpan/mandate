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

## Syncing ABIs to the frontend

`packages/shared/src/abis/*.ts` is generated from `out/`, not hand-written. After changing a
contract's public interface:

```bash
forge build
python3 - <<'EOF'
import json
for name in ["MandateRegistrar", "MandateAnchor", "AgentTreasury"]:
    with open(f"out/{name}.sol/{name}.json") as f:
        abi = json.load(f)["abi"]
    with open(f"../packages/shared/src/abis/{name}.ts", "w") as f:
        f.write(f"// Auto-generated from contracts/out/{name}.sol/{name}.json — do not hand-edit.\n")
        f.write("// Regenerate: cd contracts && forge build, then re-run the extraction (see contracts/README.md).\n")
        f.write(f"export const {name}Abi = " + json.dumps(abi, indent=2) + " as const;\n")
EOF
```

## Deploying

Every deploy script uses `forge script <path> --account $ACCOUNT --sender $SENDER` against
Foundry's encrypted keystore. A private key never appears in plaintext anywhere in this repo,
including `.env` — the sole exception is a default Anvil test key for local development, and it
is always explicitly marked as such where used.

```bash
cast wallet import mandate-deployer --interactive   # once, per machine
```

Three scripts, run in this order:

1. **`DeploySepolia.s.sol`** — deploys `MandateRegistrar` against the real ENSv2 Sepolia beta, then
   registers the org's `ORG_ENS_LABEL` as a fresh 2LD via `ETHRegistrar`'s MockUSDC commit-reveal
   flow (a real wall-clock `vm.sleep` past `MIN_COMMITMENT_AGE`, not `vm.warp` — this broadcasts
   real transactions), wiring the registrar's own `ORG_ROOT_REGISTRY` as that name's subregistry in
   the same `register()` call.
   ```bash
   forge script script/DeploySepolia.s.sol --account mandate-deployer --sender <address> \
     --rpc-url $SEPOLIA_RPC_URL --broadcast
   ```
   Copy the logged `MandateRegistrar` address into `SEPOLIA_MANDATE_REGISTRAR` and
   `NEXT_PUBLIC_MANDATE_REGISTRAR`.
2. **`DeployArc.s.sol`** — deploys `MandateAnchor` and `AgentTreasury` on Arc testnet 5042002,
   wired against the sponsor's own USDC and ERC-8183 Jobs contracts. Independent of step 1; doesn't
   touch Sepolia.
   ```bash
   forge script script/DeployArc.s.sol --account mandate-deployer --sender <address> \
     --rpc-url $ARC_RPC_URL --broadcast
   ```
   Copy the logged addresses into `ARC_MANDATE_ANCHOR`/`ARC_AGENT_TREASURY` and their
   `NEXT_PUBLIC_` counterparts.
3. **`SeedDemo.s.sol`** — issues the two demo mandates ("research", "ops") against the now-deployed
   `SEPOLIA_MANDATE_REGISTRAR`. Deliberately does not sign or submit anything to Arc: mirroring a
   mandate onto `MandateAnchor` is the Enforcer's job (run `enforcer/` next), not a one-shot
   script's — a seed script holding the Enforcer's key, even temporarily, is exactly the kind of
   plaintext-key exception these conventions exist to prevent.
   ```bash
   forge script script/SeedDemo.s.sol --account mandate-deployer --sender <address> \
     --rpc-url $SEPOLIA_RPC_URL --broadcast
   ```

Admin-facing contracts (`MandateAnchor.setEnforcer`, `AgentTreasury`'s owner) use `Ownable2Step`.
On mainnet that admin must be a multisig from the first deployment — a deployer EOA is a testnet-only
convenience, and every place we do it is commented as such.

## Standards

Cyfrin's solskill conventions throughout: custom errors prefixed `ContractName__`, strict pragma
`0.8.34` on contracts (0.8.28–0.8.33 carry a transient-storage IR bug), branching-tree `.tree`
files alongside fuzz/invariant tests, `forge fmt` + `solhint` + `slither`/`aderyn` in CI.
