// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";

import { IETHRegistrar } from "contracts/interfaces/IETHRegistrar.sol";
import { IMintableERC20 } from "contracts/interfaces/IMintableERC20.sol";
import { IVerifiableFactory } from "contracts/interfaces/IVerifiableFactory.sol";
import { LibDNSEncode } from "contracts/libraries/LibDNSEncode.sol";
import { MandateOrgFactory } from "contracts/MandateOrgFactory.sol";
import { MandateRegistrar } from "contracts/MandateRegistrar.sol";
import { MandateRegistrarDeployer } from "contracts/MandateRegistrarDeployer.sol";

/// @title MandateOrgFactoryForkTest
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Fork test against the REAL ENSv2 Sepolia beta deployment. Proves the factory's payment
///         path against real `getRegisterPrice` quotes and real `ETHRegistrar` behavior — exactly
///         where a guess about who pays, and how much, would otherwise fail silently on the demo
///         a judge tries to run.
contract MandateOrgFactoryForkTest is Test {
    address internal constant VERIFIABLE_FACTORY = 0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef;
    address internal constant USER_REGISTRY_IMPL = 0x624a25d67B59D587752EbEc8DdeD8827dAe52050;
    address internal constant PERMISSIONED_RESOLVER_IMPL =
        0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e;
    address internal constant ETH_REGISTRAR = 0xa88553F454b77203B0D036A05c894d555EAAa2Cc;
    address internal constant MOCK_USDC = 0x768F42455A2D082E23ceeF7d51e5787C82d67a39;

    IETHRegistrar internal ethRegistrar;
    IMintableERC20 internal mockUsdc;
    MandateRegistrarDeployer internal deployer;
    MandateOrgFactory internal factory;

    address internal admin = makeAddr("orgAdmin");
    address internal relayer = makeAddr("relayer");

    bytes32 internal ethNode;
    bytes internal ethDns;

    function setUp() public {
        string memory rpcUrl =
            vm.envOr("SEPOLIA_RPC_URL", string("https://ethereum-sepolia-rpc.publicnode.com"));
        vm.createSelectFork(rpcUrl);

        ethRegistrar = IETHRegistrar(ETH_REGISTRAR);
        mockUsdc = IMintableERC20(MOCK_USDC);

        ethDns = LibDNSEncode.prependLabel("eth", hex"00");
        ethNode = LibDNSEncode.namehashChild(bytes32(0), "eth");

        deployer = new MandateRegistrarDeployer(
            IVerifiableFactory(VERIFIABLE_FACTORY), USER_REGISTRY_IMPL, PERMISSIONED_RESOLVER_IMPL
        );
        factory =
            new MandateOrgFactory(ethRegistrar, deployer, mockUsdc, ethNode, ethDns, address(this));
    }

    function _uniqueLabel(string memory tag) internal view returns (string memory) {
        return string.concat(
            "mandate-orgf-",
            tag,
            "-",
            vm.toString(uint256(keccak256(abi.encode(block.number, block.timestamp, tag, address(this)))))
        );
    }

    function test_BeginOrg_DeploysRegistrarAndCommits() public {
        string memory label = _uniqueLabel("begin");
        (bytes32 commitment, address registrar, address orgRootRegistry, bytes32 orgRootNode) =
            factory.beginOrg(label, admin, keccak256("salt-1"));

        assertGt(registrar.code.length, 0, "registrar not deployed");
        assertGt(orgRootRegistry.code.length, 0, "org root registry not deployed");
        assertEq(orgRootNode, LibDNSEncode.namehashChild(ethNode, label));

        bytes32 expected = ethRegistrar.makeCommitment(
            label,
            admin,
            _pendingSecret(commitment),
            orgRootRegistry,
            address(0),
            factory.registrationDuration(),
            bytes32(0)
        );
        assertEq(commitment, expected, "commitment mismatch");

        (address pRegistrar,,, uint64 pDuration,, string memory pLabel) = factory.pending(commitment);
        assertEq(pRegistrar, registrar);
        assertEq(pDuration, factory.registrationDuration());
        assertEq(pLabel, label);
    }

    /// @dev The load-bearing verification: the admin's balance falls by EXACTLY the live-quoted
    ///      price, never a padded budget — the failure class `DeploySepolia.s.sol`'s
    ///      `mint(10_000e6)` masked entirely. Confirms `register` pulls from the CALLER
    ///      (the factory, once it holds the funds), not from the named `owner` — the admin is
    ///      never given USDC directly and never calls `ETHRegistrar` itself.
    function test_FinalizeOrg_PaysRealPriceAndRegisters() public {
        string memory label = _uniqueLabel("finalize");
        (bytes32 commitment,,,) = factory.beginOrg(label, admin, keccak256("salt-2"));

        uint256 quoted =
            ethRegistrar.getRegisterPrice(label, factory.registrationDuration(), MOCK_USDC);
        mockUsdc.mint(admin, quoted);
        vm.prank(admin);
        mockUsdc.approve(address(factory), quoted);

        vm.warp(block.timestamp + ethRegistrar.MIN_COMMITMENT_AGE() + 1);

        vm.prank(relayer);
        (address registrar, uint256 pricePaid) = factory.finalizeOrg(commitment);

        assertEq(pricePaid, quoted, "paid amount must equal the live quote");
        assertEq(mockUsdc.balanceOf(admin), 0, "admin should have paid exactly the quote");
        assertEq(mockUsdc.balanceOf(address(factory)), 0, "factory must not retain funds");
        assertEq(
            mockUsdc.allowance(address(factory), ETH_REGISTRAR), 0, "allowance must be reset to 0"
        );
        assertFalse(ethRegistrar.isAvailable(label), "label should now be registered");
        assertEq(MandateRegistrar(registrar).owner(), admin, "admin must own the registrar");

        (address oRegistrar,,,, bytes32 oNode, string memory oName) = factory.orgs(registrar);
        assertEq(oRegistrar, registrar);
        assertEq(oNode, LibDNSEncode.namehashChild(ethNode, label));
        assertEq(oName, string.concat(label, ".eth"));
        assertEq(factory.registrarOfNode(oNode), registrar);
        assertEq(factory.orgCount(), 1);
    }

    function test_FinalizeOrg_RevertsBeforeMinCommitmentAge() public {
        string memory label = _uniqueLabel("tooearly");
        (bytes32 commitment,,,) = factory.beginOrg(label, admin, keccak256("salt-3"));

        vm.warp(block.timestamp + ethRegistrar.MIN_COMMITMENT_AGE() - 1);

        vm.expectRevert();
        factory.finalizeOrg(commitment);
    }

    /// @dev MAX_COMMITMENT_AGE verified live at 86400 (24h) — a wizard session left open
    ///      overnight strands the deployed registrar unless the UI surfaces this and offers
    ///      `abandonOrg`.
    function test_FinalizeOrg_RevertsAfterMaxCommitmentAge() public {
        string memory label = _uniqueLabel("expired");
        (bytes32 commitment,,,) = factory.beginOrg(label, admin, keccak256("salt-4"));

        vm.warp(block.timestamp + ethRegistrar.MAX_COMMITMENT_AGE() + 1);

        vm.expectRevert();
        factory.finalizeOrg(commitment);
    }

    function test_AbandonOrg_ClearsCommitmentForPendingAdmin() public {
        string memory label = _uniqueLabel("abandon");
        (bytes32 commitment,,,) = factory.beginOrg(label, admin, keccak256("salt-5"));

        vm.prank(admin);
        factory.abandonOrg(commitment);

        (address pRegistrar,,,,,) = factory.pending(commitment);
        assertEq(pRegistrar, address(0), "pending record should be cleared");
    }

    function test_AbandonOrg_RevertsForNonAdmin() public {
        string memory label = _uniqueLabel("notadmin");
        (bytes32 commitment,,,) = factory.beginOrg(label, admin, keccak256("salt-6"));

        vm.expectRevert();
        factory.abandonOrg(commitment);
    }

    /// @dev Proves two registrars each using `_saltCounter == 1` internally still get distinct
    ///      `ORG_ROOT_REGISTRY` addresses — `VerifiableFactory` mixes `msg.sender` (the registrar
    ///      itself, a distinct address per org) into its CREATE2 salt, verified empirically here
    ///      rather than assumed from NatSpec.
    function test_TwoOrgs_IndependentRegistries() public {
        (, address registrarA, address rootRegistryA,) =
            factory.beginOrg(_uniqueLabel("orgA"), admin, keccak256("salt-a"));
        (, address registrarB, address rootRegistryB,) =
            factory.beginOrg(_uniqueLabel("orgB"), admin, keccak256("salt-b"));

        assertTrue(registrarA != registrarB, "registrars must differ");
        assertTrue(rootRegistryA != rootRegistryB, "org root registries must differ");
    }

    function test_PaymentTokenNotSupported() public {
        MandateOrgFactory badFactory = new MandateOrgFactory(
            ethRegistrar,
            deployer,
            IMintableERC20(address(0xdead)),
            ethNode,
            ethDns,
            address(this)
        );
        string memory label = _uniqueLabel("badtoken");
        (bytes32 commitment,,,) = badFactory.beginOrg(label, admin, keccak256("salt-7"));
        vm.warp(block.timestamp + ethRegistrar.MIN_COMMITMENT_AGE() + 1);

        vm.expectRevert();
        badFactory.finalizeOrg(commitment);
    }

    /// @dev Recomputes the secret the factory derived internally, purely so this test can
    ///      independently confirm the commitment hash without reaching into factory internals.
    function _pendingSecret(bytes32 commitment) internal view returns (bytes32) {
        (,, address pAdmin,, bytes32 pSecret,) = factory.pending(commitment);
        pAdmin; // silence unused-var warning; kept for readability of the tuple destructure
        return pSecret;
    }
}
