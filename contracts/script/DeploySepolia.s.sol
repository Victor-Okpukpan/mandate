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
/// @custom:security-contact security@runmandate.xyz
/// @notice Deploys `MandateRegistrar` against the real ENSv2 Sepolia beta, then registers the
///         org's own 2LD via `ETHRegistrar`'s MockUSDC commit-reveal flow — wiring the freshly
///         deployed registrar's own `ORG_ROOT_REGISTRY` as that name's subregistry in the same
///         `register()` call, exactly as `test/fork/MandateRegistrarFork.t.sol` already proves
///         against live chain state. This script only ever registers a brand-new 2LD (no existing
///         Sepolia `.eth` name is assumed to already exist for the org): ENSv2's beta deployment
///         has no real owners to speak of yet, so "the org's name" here means "a name this deploy
///         freshly claims," identical in spirit to the fork test's uniquely-labeled scratch name.
/// @dev Run with: `forge script script/DeploySepolia.s.sol --account $ACCOUNT --sender $SENDER
///      --rpc-url $SEPOLIA_RPC_URL --broadcast` — never with a plaintext key (see
///      contracts/README.md). Requires `ORG_ENS_LABEL` (the bare label, e.g. "acme" for
///      "acme.eth" — NOT the full name, since only `ETHRegistrar` decides the TLD) and
///      `MANDATE_INITIAL_OWNER` in the environment; every ENSv2 address is read from
///      `.env`'s already-populated `SEPOLIA_*` vars with the fork test's addresses as a fallback,
///      matching this repo's default-with-override convention (see `.env.example`).
contract DeploySepolia is Script {
    uint64 internal constant TWO_LD_DURATION = 2_419_200; // ETHRegistrar's MIN_REGISTER_DURATION, 28 days
    uint256 internal constant TWO_LD_USDC_BUDGET = 10_000e6; // headroom over the observed ~0.61 USDC/28d cost

    function run() external returns (MandateRegistrar registrar) {
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
        address ethRegistrarAddr =
            vm.envOr("SEPOLIA_ETH_REGISTRAR", address(0xa88553F454b77203B0D036A05c894d555EAAa2Cc));
        address mockUsdcAddr =
            vm.envOr("SEPOLIA_MOCK_USDC", address(0x768F42455A2D082E23ceeF7d51e5787C82d67a39));

        string memory orgLabel = vm.envString("ORG_ENS_LABEL");
        address initialOwner = vm.envAddress("MANDATE_INITIAL_OWNER");

        string memory orgEnsName = string.concat(orgLabel, ".eth");
        bytes memory ethDns = LibDNSEncode.prependLabel("eth", hex"00");
        bytes memory orgRootDns = LibDNSEncode.prependLabel(orgLabel, ethDns);
        bytes32 ethNode = LibDNSEncode.namehashChild(bytes32(0), "eth");
        bytes32 orgRootNode = LibDNSEncode.namehashChild(ethNode, orgLabel);

        vm.startBroadcast();

        registrar = new MandateRegistrar(
            IVerifiableFactory(verifiableFactory),
            userRegistryImpl,
            resolverImpl,
            orgRootNode,
            orgRootDns,
            orgEnsName,
            initialOwner
        );
        address orgRootRegistry = address(registrar.ORG_ROOT_REGISTRY());

        _registerOrgTwoLD(
            IETHRegistrar(ethRegistrarAddr), IMintableERC20(mockUsdcAddr), orgLabel, orgRootRegistry
        );

        vm.stopBroadcast();

        console2.log("MandateRegistrar deployed:", address(registrar));
        console2.log("Org 2LD registered:", orgEnsName);
        console2.log("Org root registry:", orgRootRegistry);
        console2.log(
            "Set SEPOLIA_MANDATE_REGISTRAR and NEXT_PUBLIC_MANDATE_REGISTRAR to the address above."
        );
    }

    /// @dev Mints the broadcaster enough MockUSDC to cover the 28-day 2LD registration fee, then
    ///      runs the commit-reveal flow with a real wall-clock `vm.sleep` past
    ///      `MIN_COMMITMENT_AGE` — this is a live broadcast, not a test EVM, so `vm.warp` cannot
    ///      substitute for actually waiting. `MockUSDC.mint` is confirmed permissionless (see
    ///      `IMintableERC20`'s NatSpec); no faucet is required for the name itself, only Sepolia
    ///      ETH for gas.
    function _registerOrgTwoLD(
        IETHRegistrar ethRegistrar,
        IMintableERC20 mockUsdc,
        string memory orgLabel,
        address orgRootRegistry
    ) internal {
        mockUsdc.mint(msg.sender, TWO_LD_USDC_BUDGET);
        mockUsdc.approve(address(ethRegistrar), TWO_LD_USDC_BUDGET);

        bytes32 secret = keccak256(abi.encodePacked("mandate-deploy-secret", block.timestamp));
        bytes32 commitment = ethRegistrar.makeCommitment(
            orgLabel, msg.sender, secret, orgRootRegistry, address(0), TWO_LD_DURATION, bytes32(0)
        );

        ethRegistrar.commit(commitment);
        vm.sleep((ethRegistrar.MIN_COMMITMENT_AGE() + 1) * 1000);

        ethRegistrar.register(
            orgLabel,
            msg.sender,
            secret,
            orgRootRegistry,
            address(0),
            TWO_LD_DURATION,
            address(mockUsdc),
            bytes32(0)
        );
    }
}
