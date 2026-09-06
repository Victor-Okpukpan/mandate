// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";

import { AgentTreasury } from "contracts/AgentTreasury.sol";
import { ArcVaultFactory } from "contracts/ArcVaultFactory.sol";
import { MandateAnchor } from "contracts/MandateAnchor.sol";

import { MockERC20 } from "./mocks/MockERC20.sol";
import { MockJobs } from "./mocks/MockJobs.sol";

contract ArcVaultFactoryTest is Test {
    MockERC20 internal usdc;
    MockJobs internal jobs;
    ArcVaultFactory internal factory;

    address internal factoryOwner = makeAddr("factoryOwner");
    address internal orgAdmin = makeAddr("orgAdmin");
    address internal enforcer = makeAddr("enforcer");

    function setUp() public {
        usdc = new MockERC20();
        jobs = new MockJobs(usdc);
        factory = new ArcVaultFactory(usdc, jobs, factoryOwner);
    }

    function test_CreateVault_WiresAnchorAndTreasury() public {
        (address anchor, address treasury) = factory.createVault(orgAdmin, enforcer);

        assertEq(MandateAnchor(anchor).owner(), orgAdmin);
        assertEq(MandateAnchor(anchor).enforcer(), enforcer);
        assertEq(AgentTreasury(treasury).owner(), orgAdmin);
        assertEq(address(AgentTreasury(treasury).ANCHOR()), anchor);
        assertEq(address(AgentTreasury(treasury).USDC()), address(usdc));
        assertEq(address(AgentTreasury(treasury).JOBS()), address(jobs));

        (address vAnchor, address vTreasury, address vAdmin,, uint64 createdAt) =
            factory.vaults(anchor);
        assertEq(vAnchor, anchor);
        assertEq(vTreasury, treasury);
        assertEq(vAdmin, orgAdmin);
        assertEq(createdAt, uint64(block.timestamp));
        assertEq(factory.vaultCount(), 1);
    }

    /// @dev The concrete form of "an Enforcer signature for org A cannot replay on org B's
    ///      anchor" — EIP-712 domain separators bake in `address(this)`, so two anchors must
    ///      differ even with identical constructor args otherwise.
    function test_TwoVaults_DistinctDomainSeparators() public {
        (address anchorA,) = factory.createVault(orgAdmin, enforcer);
        (address anchorB,) = factory.createVault(orgAdmin, enforcer);

        assertTrue(anchorA != anchorB);
        (, string memory nameA, string memory versionA, uint256 chainIdA, address verifyingA,,) =
            MandateAnchor(anchorA).eip712Domain();
        (,,,, address verifyingB,,) = MandateAnchor(anchorB).eip712Domain();
        assertEq(verifyingA, anchorA);
        assertEq(verifyingB, anchorB);
        assertTrue(verifyingA != verifyingB);
        assertEq(nameA, "MandateAnchor");
        assertEq(versionA, "1");
        assertEq(chainIdA, block.chainid);
    }

    function test_CreateVault_UsesFactoryDefaults() public {
        (address anchor, address treasury) = factory.createVault(orgAdmin, enforcer);
        assertEq(MandateAnchor(anchor).maxStaleness(), factory.defaultMaxStaleness());
        assertEq(AgentTreasury(treasury).maxGasFloat(), factory.defaultMaxGasFloat());
        assertEq(AgentTreasury(treasury).utilisationCapBps(), factory.defaultUtilisationCapBps());
        assertEq(AgentTreasury(treasury).interestRateBps(), factory.defaultInterestRateBps());
    }

    function test_CreateVault_RevertsOnZeroAddress() public {
        vm.expectRevert(ArcVaultFactory.ArcVaultFactory__ZeroAddress.selector);
        factory.createVault(address(0), enforcer);

        vm.expectRevert(ArcVaultFactory.ArcVaultFactory__ZeroAddress.selector);
        factory.createVault(orgAdmin, address(0));
    }

    function test_SetDefaults_OnlyOwner() public {
        vm.expectRevert();
        factory.setDefaultMaxStaleness(1800);

        vm.prank(factoryOwner);
        factory.setDefaultMaxStaleness(1800);
        assertEq(factory.defaultMaxStaleness(), 1800);
    }

    function test_VaultsOfAdmin_TracksCreator() public {
        factory.createVault(orgAdmin, enforcer);
        factory.createVault(orgAdmin, enforcer);
        assertEq(factory.vaultsOfAdmin(orgAdmin).length, 2);
    }
}
