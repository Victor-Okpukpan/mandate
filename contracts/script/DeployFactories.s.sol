// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { Script, console2 } from "forge-std/Script.sol";

import { IERC20 } from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import { ArcVaultFactory } from "contracts/ArcVaultFactory.sol";
import { IERC8183Jobs } from "contracts/interfaces/IERC8183Jobs.sol";
import { IETHRegistrar } from "contracts/interfaces/IETHRegistrar.sol";
import { IVerifiableFactory } from "contracts/interfaces/IVerifiableFactory.sol";
import { LibDNSEncode } from "contracts/libraries/LibDNSEncode.sol";
import { MandateOrgFactory } from "contracts/MandateOrgFactory.sol";
import { MandateRegistrarDeployer } from "contracts/MandateRegistrarDeployer.sol";

/// @title DeployFactories
/// @author Victor Okpukpan (@victorokpukpan_)
/// @custom:security-contact https://x.com/victorokpukpan_
/// @notice Deploys the two platform factories — `MandateRegistrarDeployer` + `MandateOrgFactory`
///         on Sepolia, `ArcVaultFactory` on Arc — that replace the old `DeploySepolia.s.sol` +
///         `DeployArc.s.sol` per-org scripts. This is a ONE-TIME deploy per platform instance, run
///         by whoever operates the site, not per organisation: HOW-IT-WORKS.md §4's whole point is
///         that onboarding a new org afterward is a wizard, not a script. Deliberately mints
///         nothing — `MandateOrgFactory.finalizeOrg` quotes ENSv2's real `getRegisterPrice` and
///         pulls it from the org admin, the same real-payment path that replaced
///         `DeploySepolia.s.sol`'s `IMintableERC20.mint(msg.sender, 10_000e6)`.
/// @dev Run with (never a plaintext key — see contracts/README.md):
///      ```
///      forge script script/DeployFactories.s.sol --sig "runSepolia()" --account $ACCOUNT \
///        --sender $SENDER --rpc-url $SEPOLIA_RPC_URL --broadcast
///      forge script script/DeployFactories.s.sol --sig "runArc()" --account $ACCOUNT \
///        --sender $SENDER --rpc-url $ARC_RPC_URL --broadcast
///      ```
///      `runSepolia` requires `SEPOLIA_MANDATE_ORG_FACTORY_OWNER` (falls back to the caller);
///      `runArc` requires `ENFORCER_ADDRESS` is NOT needed here — `enforcer` is per-vault, chosen
///      by each org at `createVault` time, not fixed at factory deployment.
contract DeployFactories is Script {
    function runSepolia()
        external
        returns (MandateRegistrarDeployer deployer, MandateOrgFactory factory)
    {
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
        address paymentToken =
            vm.envOr("SEPOLIA_MOCK_USDC", address(0x768F42455A2D082E23ceeF7d51e5787C82d67a39));
        address factoryOwner = vm.envOr("SEPOLIA_MANDATE_ORG_FACTORY_OWNER", msg.sender);

        bytes memory ethDns = LibDNSEncode.prependLabel("eth", hex"00");
        bytes32 ethNode = LibDNSEncode.namehashChild(bytes32(0), "eth");

        vm.startBroadcast();

        deployer = new MandateRegistrarDeployer(
            IVerifiableFactory(verifiableFactory), userRegistryImpl, resolverImpl
        );
        factory = new MandateOrgFactory(
            IETHRegistrar(ethRegistrarAddr),
            deployer,
            IERC20(paymentToken),
            ethNode,
            ethDns,
            factoryOwner
        );

        vm.stopBroadcast();

        console2.log("MandateRegistrarDeployer deployed:", address(deployer));
        console2.log("MandateOrgFactory deployed:", address(factory));
        console2.log("Set SEPOLIA_MANDATE_ORG_FACTORY and its NEXT_PUBLIC_ counterpart.");
    }

    function runArc() external returns (ArcVaultFactory factory) {
        address usdc = vm.envOr("ARC_USDC", address(0x3600000000000000000000000000000000000000));
        address jobs =
            vm.envOr("ARC_ERC8183_JOBS", address(0x0747EEf0706327138c69792bF28Cd525089e4583));
        address factoryOwner = vm.envOr("ARC_VAULT_FACTORY_OWNER", msg.sender);

        vm.startBroadcast();
        factory = new ArcVaultFactory(IERC20(usdc), IERC8183Jobs(jobs), factoryOwner);
        vm.stopBroadcast();

        console2.log("ArcVaultFactory deployed:", address(factory));
        console2.log("Set ARC_VAULT_FACTORY and its NEXT_PUBLIC_ counterpart.");
    }
}
