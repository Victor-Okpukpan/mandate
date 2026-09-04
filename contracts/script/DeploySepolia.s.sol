// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { Script, console2 } from "forge-std/Script.sol";

import { IETHRegistrar } from "contracts/interfaces/IETHRegistrar.sol";
import { IMintableERC20 } from "contracts/interfaces/IMintableERC20.sol";
import { IVerifiableFactory } from "contracts/interfaces/IVerifiableFactory.sol";
import { LibDNSEncode } from "contracts/libraries/LibDNSEncode.sol";
import { MandateRegistrar } from "contracts/MandateRegistrar.sol";

/// @title DeploySepolia
/// @author Victor Okpukpan (@victorokpukpan_)
/// @custom:security-contact https://x.com/victorokpukpan_
/// @notice Deploys `MandateRegistrar` against the real ENSv2 Sepolia beta, then registers the
///         org's own 2LD via `ETHRegistrar`'s MockUSDC commit-reveal flow — wiring the freshly
///         deployed registrar's own `ORG_ROOT_REGISTRY` as that name's subregistry in the same
///         `register()` call, exactly as `test/fork/MandateRegistrarFork.t.sol` already proves
///         against live chain state. This script only ever registers a brand-new 2LD (no existing
///         Sepolia `.eth` name is assumed to already exist for the org): ENSv2's beta deployment
///         has no real owners to speak of yet, so "the org's name" here means "a name this deploy
///         freshly claims," identical in spirit to the fork test's uniquely-labeled scratch name.
/// @dev Split into two entry points, run as two SEPARATE `forge script` invocations with a real
///      wait in between — `forge script` fully simulates a script's entire execution before
///      broadcasting anything, and that simulation evaluates every call at the same
///      `block.timestamp`, so `vm.sleep` cannot bridge `ETHRegistrar`'s `MIN_COMMITMENT_AGE`
///      within a single invocation (confirmed against live Sepolia: the register() call reverted
///      with `CommitmentTooNew`-shaped data showing zero elapsed time between commit and reveal,
///      even under `--broadcast`, since nothing is ever broadcast if the simulation itself
///      reverts). Two real transactions, separated by real wall-clock time between two `forge
///      script` runs, do not have this problem. `secret` is deterministic (derived from the org
///      label alone, not a nonce or timestamp) precisely so `register()`'s later, separate
///      invocation can recompute the exact same commitment without needing state passed between
///      runs — safe here because `register()` reveals label+secret atomically with the
///      registration itself, so there is no window in which a guessable secret helps a
///      third party who does not already know which label is being registered.
///
///      Run with (never a plaintext key — see contracts/README.md):
///      ```
///      forge script script/DeploySepolia.s.sol --sig "commit()" --account $ACCOUNT \
///        --sender $SENDER --rpc-url $SEPOLIA_RPC_URL --broadcast
///      # wait at least MIN_COMMITMENT_AGE (60s) — real time, not vm.sleep
///      SEPOLIA_MANDATE_REGISTRAR=<logged address> forge script script/DeploySepolia.s.sol \
///        --sig "register()" --account $ACCOUNT --sender $SENDER \
///        --rpc-url $SEPOLIA_RPC_URL --broadcast
///      ```
///      Requires `ORG_ENS_LABEL` (the bare label, e.g. "acme" for "acme.eth" — NOT the full name,
///      since only `ETHRegistrar` decides the TLD) and `MANDATE_INITIAL_OWNER` for `commit()`;
///      `register()` additionally requires `SEPOLIA_MANDATE_REGISTRAR`, the address `commit()`
///      just deployed and logged. Every ENSv2 address is read from `.env`'s already-populated
///      `SEPOLIA_*` vars with the fork test's addresses as a fallback (see `.env.example`).
contract DeploySepolia is Script {
    uint64 internal constant TWO_LD_DURATION = 2_419_200; // ETHRegistrar's MIN_REGISTER_DURATION, 28 days
    uint256 internal constant TWO_LD_USDC_BUDGET = 10_000e6; // headroom over the observed ~0.61 USDC/28d cost

    /// @notice Phase 1: deploys `MandateRegistrar`, mints/approves MockUSDC, and commits to
    ///         registering `ORG_ENS_LABEL`. Wait at least 60 real seconds before running
    ///         `register()`.
    function commit() external returns (MandateRegistrar registrar) {
        address ethRegistrarAddr =
            vm.envOr("SEPOLIA_ETH_REGISTRAR", address(0xa88553F454b77203B0D036A05c894d555EAAa2Cc));
        address mockUsdcAddr =
            vm.envOr("SEPOLIA_MOCK_USDC", address(0x768F42455A2D082E23ceeF7d51e5787C82d67a39));
        string memory orgLabel = vm.envString("ORG_ENS_LABEL");

        vm.startBroadcast();

        registrar = _deployRegistrar(orgLabel);
        address orgRootRegistry = address(registrar.ORG_ROOT_REGISTRY());

        IMintableERC20 mockUsdc = IMintableERC20(mockUsdcAddr);
        mockUsdc.mint(msg.sender, TWO_LD_USDC_BUDGET);
        mockUsdc.approve(ethRegistrarAddr, TWO_LD_USDC_BUDGET);

        bytes32 secret = _deriveSecret(orgLabel);
        bytes32 commitment = IETHRegistrar(ethRegistrarAddr).makeCommitment(
            orgLabel, msg.sender, secret, orgRootRegistry, address(0), TWO_LD_DURATION, bytes32(0)
        );
        IETHRegistrar(ethRegistrarAddr).commit(commitment);

        vm.stopBroadcast();

        console2.log("MandateRegistrar deployed:", address(registrar));
        console2.log("Org root registry:", orgRootRegistry);
        console2.log("Commitment made for:", string.concat(orgLabel, ".eth"));
        console2.log("Wait >=60 real seconds, then run register() with SEPOLIA_MANDATE_REGISTRAR set to the address above.");
    }

    /// @notice Phase 2: reveals the commitment made by `commit()` and completes registration.
    ///         Run only after `commit()`'s transaction has been mined for at least
    ///         `MIN_COMMITMENT_AGE` real seconds.
    function register() external {
        address ethRegistrarAddr =
            vm.envOr("SEPOLIA_ETH_REGISTRAR", address(0xa88553F454b77203B0D036A05c894d555EAAa2Cc));
        address mockUsdcAddr =
            vm.envOr("SEPOLIA_MOCK_USDC", address(0x768F42455A2D082E23ceeF7d51e5787C82d67a39));
        string memory orgLabel = vm.envString("ORG_ENS_LABEL");
        MandateRegistrar registrar = MandateRegistrar(vm.envAddress("SEPOLIA_MANDATE_REGISTRAR"));
        address orgRootRegistry = address(registrar.ORG_ROOT_REGISTRY());

        bytes32 secret = _deriveSecret(orgLabel);

        vm.startBroadcast();
        IETHRegistrar(ethRegistrarAddr).register(
            orgLabel,
            msg.sender,
            secret,
            orgRootRegistry,
            address(0),
            TWO_LD_DURATION,
            mockUsdcAddr,
            bytes32(0)
        );
        vm.stopBroadcast();

        console2.log("Org 2LD registered:", string.concat(orgLabel, ".eth"));
        console2.log(
            "Set SEPOLIA_MANDATE_REGISTRAR and NEXT_PUBLIC_MANDATE_REGISTRAR to:", address(registrar)
        );
    }

    function _deployRegistrar(string memory orgLabel) internal returns (MandateRegistrar) {
        address verifiableFactory = vm.envOr(
            "SEPOLIA_VERIFIABLE_FACTORY", address(0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef)
        );
        address userRegistryImpl = vm.envOr(
            "SEPOLIA_USER_REGISTRY_IMPL", address(0x624a25d67B59D587752EbEc8DdeD8827dAe52050)
        );
        address resolverImpl = vm.envOr(
            "SEPOLIA_PERMISSIONED_RESOLVER_IMPL",
            address(0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e)
        );
        address initialOwner = vm.envAddress("MANDATE_INITIAL_OWNER");

        string memory orgEnsName = string.concat(orgLabel, ".eth");
        bytes memory ethDns = LibDNSEncode.prependLabel("eth", hex"00");
        bytes memory orgRootDns = LibDNSEncode.prependLabel(orgLabel, ethDns);
        bytes32 ethNode = LibDNSEncode.namehashChild(bytes32(0), "eth");
        bytes32 orgRootNode = LibDNSEncode.namehashChild(ethNode, orgLabel);

        return new MandateRegistrar(
            IVerifiableFactory(verifiableFactory),
            userRegistryImpl,
            resolverImpl,
            orgRootNode,
            orgRootDns,
            orgEnsName,
            initialOwner
        );
    }

    /// @dev Deterministic on purpose — see the contract-level NatSpec for why that's safe here.
    function _deriveSecret(string memory orgLabel) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("mandate-deploy-secret", orgLabel));
    }
}
