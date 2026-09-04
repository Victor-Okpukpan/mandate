# FEEDBACK

Friction logged as it was found, against real deployed contracts and real documentation — not
retrospective.

## ENSv2 beta (Sepolia)

**`ETHRegistrar` is missing from the published deployments page**, and its ABI isn't v1-shaped —
`available`, `rentPrice`, and `minCommitmentAge` all revert on the real deployment. The actual
registration flow (`isAvailable`, `getRegisterPrice`, `makeCommitment`/`commit`/`register`) had to
be recovered by extracting selectors from the deployed bytecode and matching them against
openchain.xyz's signature database, then confirmed by simulating each call. Worth adding to the
docs directly, alongside the fact that 2LD registration is priced in `MockUSDC`/`MockDAI`, not ETH
— `isPaymentToken(address(0))` returns `false` on the live contract, which isn't obvious from
anywhere in the docs.

**The docs' role table doesn't ship the real values, and says so.** `docs.ens.domains/ensv2/*`
states its role table "may change prior to mainnet deployment." That's honest, but it means anyone
building against it has to go find the real source (`ensdomains/contracts-v2`,
`src/registry/libraries/RegistryRolesLib.sol` and
`src/resolver/libraries/PermissionedResolverLib.sol`) rather than trust the docs site — worth a
direct link from the docs page to those two files specifically, since they're the actual source of
truth and aren't where a docs reader would think to look.

**The single most valuable thing a beta integration found, and only a fork test would have caught
it:** `PermissionedResolver.initialize()`'s permission-check bypass during `_isInitializing()`
covers direct setters (`setText`, `setAddr`, etc.) but *not* the `authorizeTextRoles` /
`authorizeAddrRoles` / `authorizeDataRoles` grant path, because those go through a separate
internal check (`_checkCanGrantRoles`) that the override doesn't touch. Combined with
`VerifiableFactory.deployProxy()` calling `initialize()` directly (so the factory, not the intended
admin, is `msg.sender` throughout the whole `multicall` batch via its delegatecall relay), a grant
call placed inside the init batch fails outright — and would only fail with a real signer's
permissions checked, which a mock resolver never exercises. This cost real debugging time and would
be worth either documenting explicitly or fixing (making the initializer's bypass cover the grant
path too, since the whole point of `initialize()` is presumably to let a deployer configure a
fresh resolver instance in one atomic step).

## Circle Agent Stack

Not yet exercised — the agent runtimes (`agents/`) that would integrate the
`circlefin/agent-stack-starter-kits` claude-agent-sdk kit haven't been built in this pass. This
section will be filled in once they are.
