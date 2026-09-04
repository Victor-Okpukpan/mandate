// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";

import { IPermissionedResolver } from "contracts/interfaces/IPermissionedResolver.sol";
import { IUserRegistry } from "contracts/interfaces/IUserRegistry.sol";
import { IVerifiableFactory } from "contracts/interfaces/IVerifiableFactory.sol";
import { LibDNSEncode } from "contracts/libraries/LibDNSEncode.sol";
import { MandateKeys } from "contracts/libraries/MandateKeys.sol";
import { MandateRegistrar } from "contracts/MandateRegistrar.sol";

import { IETHRegistrar } from "contracts-test/fork/interfaces/IETHRegistrar.sol";
import { IMintableERC20 } from "contracts-test/fork/interfaces/IMintableERC20.sol";

/// @title MandateRegistrarForkTest
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Fork test against the REAL ENSv2 Sepolia beta deployment — no mocks for anything
///         ENS-shaped. Verifies `MandateRegistrar` against actual on-chain behavior rather than an
///         idealized reimplementation of it, which is exactly where an integration against beta
///         software breaks first. Registers a real, uniquely-labeled 2LD via `ETHRegistrar`'s
///         MockUSDC commit-reveal flow, wires it to a freshly-deployed `MandateRegistrar`'s own org
///         root registry, and exercises the full mandate lifecycle against the live contracts.
contract MandateRegistrarForkTest is Test {
    // ENSv2 Sepolia — verified addresses, see .env.example / SPONSOR-NOTES.
    address internal constant VERIFIABLE_FACTORY = 0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef;
    address internal constant USER_REGISTRY_IMPL = 0x624a25d67B59D587752EbEc8DdeD8827dAe52050;
    address internal constant PERMISSIONED_RESOLVER_IMPL =
        0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e;
    address internal constant ETH_REGISTRAR = 0xa88553F454b77203B0D036A05c894d555EAAa2Cc;
    address internal constant MOCK_USDC = 0x768F42455A2D082E23ceeF7d51e5787C82d67a39;

    uint64 internal constant TWO_LD_DURATION = 2_419_200; // MIN_REGISTER_DURATION, 28 days

    MandateRegistrar internal registrar;
    IUserRegistry internal orgRootRegistry;
    IETHRegistrar internal ethRegistrar;
    IMintableERC20 internal mockUsdc;

    address internal orgAdmin = makeAddr("orgAdmin");
    address internal agentWallet = makeAddr("agentWallet");
    address internal arcWallet = makeAddr("arcWallet");
    address internal subAgentWallet = makeAddr("subAgentWallet");

    string internal orgLabel;
    string internal orgEnsName;
    bytes internal orgRootDns;
    bytes32 internal orgRootNode;

    function setUp() public {
        string memory rpcUrl =
            vm.envOr("SEPOLIA_RPC_URL", string("https://ethereum-sepolia-rpc.publicnode.com"));
        vm.createSelectFork(rpcUrl);

        ethRegistrar = IETHRegistrar(ETH_REGISTRAR);
        mockUsdc = IMintableERC20(MOCK_USDC);

        // A label unique to this fork run — real Sepolia state is shared with everyone else
        // testing against the same ENSv2 beta deployment.
        orgLabel = string.concat(
            "mandate-fork-",
            vm.toString(uint256(keccak256(abi.encode(block.number, address(this)))))
        );
        orgEnsName = string.concat(orgLabel, ".eth");

        bytes memory ethDns = LibDNSEncode.prependLabel("eth", hex"00");
        orgRootDns = LibDNSEncode.prependLabel(orgLabel, ethDns);
        bytes32 ethNode = LibDNSEncode.namehashChild(bytes32(0), "eth");
        orgRootNode = LibDNSEncode.namehashChild(ethNode, orgLabel);

        registrar = new MandateRegistrar(
            IVerifiableFactory(VERIFIABLE_FACTORY),
            USER_REGISTRY_IMPL,
            PERMISSIONED_RESOLVER_IMPL,
            orgRootNode,
            orgRootDns,
            orgEnsName,
            orgAdmin
        );
        orgRootRegistry = registrar.ORG_ROOT_REGISTRY();

        _registerOrgTwoLD();
    }

    /// @dev Registers `orgLabel.eth` via the real ETHRegistrar, wiring `orgRootRegistry` as its
    ///      subregistry so subname resolution actually reaches `MandateRegistrar`'s own registry.
    function _registerOrgTwoLD() internal {
        deal(address(this), 1 ether);
        mockUsdc.mint(address(this), 10_000e6);
        mockUsdc.approve(ETH_REGISTRAR, type(uint256).max);

        bytes32 secret = keccak256("mandate-fork-test-secret");
        bytes32 commitment = ethRegistrar.makeCommitment(
            orgLabel,
            orgAdmin,
            secret,
            address(orgRootRegistry),
            address(0),
            TWO_LD_DURATION,
            bytes32(0)
        );

        ethRegistrar.commit(commitment);
        vm.warp(block.timestamp + ethRegistrar.MIN_COMMITMENT_AGE() + 1);

        ethRegistrar.register(
            orgLabel,
            orgAdmin,
            secret,
            address(orgRootRegistry),
            address(0),
            TWO_LD_DURATION,
            MOCK_USDC,
            bytes32(0)
        );
    }

    function _defaultTerms(uint64 expiry)
        internal
        pure
        returns (MandateRegistrar.MandateTerms memory)
    {
        return MandateRegistrar.MandateTerms({
            allowlistRoot: keccak256("allowlist-root"),
            budgetTotal: 500_000_000, // 500 USDC, 6dp
            perTxCap: 50_000_000, // 50 USDC
            expiry: expiry,
            budgetPeriod: 86_400,
            maxDepth: 2
        });
    }

    /*//////////////////////////////////////////////////////////////
                                  TESTS
    //////////////////////////////////////////////////////////////*/

    function test_2LDRegistration_WiresOrgRootRegistryAsSubregistry() public view {
        // Confirms the fork setup itself is sound before trusting any test built on it.
        assertTrue(address(orgRootRegistry).code.length > 0, "org root registry has no code");
    }

    function test_IssueMandate_WritesResolverRecordsAndGrantsOnlyAgentKeys() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));

        vm.prank(orgAdmin);
        (bytes32 node, address resolverAddr) =
            registrar.issueMandate("research", agentWallet, terms, arcWallet, "[]");

        IPermissionedResolver resolver = IPermissionedResolver(resolverAddr);

        assertEq(
            resolver.text(node, MandateKeys.BUDGET_TOTAL), "500000000", "budget.total mismatch"
        );
        assertEq(
            resolver.text(node, MandateKeys.BUDGET_PER_TX), "50000000", "budget.perTx mismatch"
        );
        assertEq(resolver.text(node, MandateKeys.PRINCIPAL), orgEnsName, "principal mismatch");
        assertEq(resolver.text(node, MandateKeys.DEPTH), "2", "depth mismatch");

        // The agent CAN write its own status —
        vm.prank(agentWallet);
        resolver.setText(node, MandateKeys.STATUS, "working");
        assertEq(resolver.text(node, MandateKeys.STATUS), "working");

        // — but CANNOT write its own budget. This one check is the whole security argument.
        vm.prank(agentWallet);
        vm.expectRevert();
        resolver.setText(node, MandateKeys.BUDGET_TOTAL, "999999999999");
    }

    function test_IssueMandate_RegistryRoleBitmapIsSoulboundAndNonRenewable() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));

        vm.prank(orgAdmin);
        (bytes32 node,) = registrar.issueMandate("ops", agentWallet, terms, arcWallet, "[]");

        MandateRegistrar.Mandate memory mandate = registrar.getMandate(node);
        assertEq(
            orgRootRegistry.getOwner(mandate.tokenId), agentWallet, "agent should own the token"
        );

        // Agent holds no registry-level roles at all — soulbound, non-renewable-by-itself.
        assertEq(
            orgRootRegistry.roles(mandate.tokenId, agentWallet),
            0,
            "agent must hold zero registry roles"
        );
    }

    function test_Attenuate_NarrowsAndBlocksWidening() public {
        MandateRegistrar.MandateTerms memory parentTerms =
            _defaultTerms(uint64(block.timestamp + 7 days));
        vm.prank(orgAdmin);
        (bytes32 parentNode,) =
            registrar.issueMandate("research", agentWallet, parentTerms, arcWallet, "[]");

        MandateRegistrar.MandateTerms memory childTerms =
            _defaultTerms(uint64(block.timestamp + 7 days));
        childTerms.budgetTotal = 50_000_000; // well within parent headroom
        childTerms.perTxCap = 5_000_000;

        vm.prank(agentWallet);
        (bytes32 childNode,) =
            registrar.attenuate(parentNode, "scraper", subAgentWallet, childTerms, arcWallet, "[]");

        MandateRegistrar.MandateTerms memory stored = registrar.termsOf(childNode);
        assertEq(stored.maxDepth, 1, "child depth must be parent depth - 1");
        assertEq(
            stored.allowlistRoot,
            parentTerms.allowlistRoot,
            "child must inherit parent's allowlistRoot verbatim"
        );

        // Widening the budget past parent headroom must revert.
        MandateRegistrar.MandateTerms memory tooWide = childTerms;
        tooWide.budgetTotal = parentTerms.budgetTotal; // the whole parent budget, already partly committed
        vm.prank(agentWallet);
        vm.expectRevert();
        registrar.attenuate(parentNode, "scraper2", subAgentWallet, tooWide, arcWallet, "[]");

        // Widening the per-tx cap past the parent's must revert.
        MandateRegistrar.MandateTerms memory capTooHigh = childTerms;
        capTooHigh.perTxCap = parentTerms.perTxCap + 1;
        vm.prank(agentWallet);
        vm.expectRevert();
        registrar.attenuate(parentNode, "scraper3", subAgentWallet, capTooHigh, arcWallet, "[]");

        // Extending expiry past the parent's must revert.
        MandateRegistrar.MandateTerms memory expiryTooLate = childTerms;
        expiryTooLate.expiry = parentTerms.expiry + 1;
        vm.prank(agentWallet);
        vm.expectRevert();
        registrar.attenuate(parentNode, "scraper4", subAgentWallet, expiryTooLate, arcWallet, "[]");
    }

    function test_Attenuate_RevertsWhenCallerIsNotParentAgentOrOwner() public {
        MandateRegistrar.MandateTerms memory parentTerms =
            _defaultTerms(uint64(block.timestamp + 7 days));
        vm.prank(orgAdmin);
        (bytes32 parentNode,) =
            registrar.issueMandate("research", agentWallet, parentTerms, arcWallet, "[]");

        MandateRegistrar.MandateTerms memory childTerms =
            _defaultTerms(uint64(block.timestamp + 7 days));
        childTerms.budgetTotal = 1_000_000;

        vm.prank(makeAddr("stranger"));
        vm.expectRevert();
        registrar.attenuate(parentNode, "scraper", subAgentWallet, childTerms, arcWallet, "[]");
    }

    function test_RevokeMandate_BurnsNameAndFreesParentHeadroom() public {
        MandateRegistrar.MandateTerms memory parentTerms =
            _defaultTerms(uint64(block.timestamp + 7 days));
        vm.prank(orgAdmin);
        (bytes32 parentNode,) =
            registrar.issueMandate("research", agentWallet, parentTerms, arcWallet, "[]");

        MandateRegistrar.MandateTerms memory childTerms =
            _defaultTerms(uint64(block.timestamp + 7 days));
        childTerms.budgetTotal = 50_000_000;
        vm.prank(agentWallet);
        (bytes32 childNode,) =
            registrar.attenuate(parentNode, "scraper", subAgentWallet, childTerms, arcWallet, "[]");

        assertEq(
            registrar.getMandate(parentNode).committed,
            50_000_000,
            "parent should show the commitment"
        );

        vm.prank(orgAdmin);
        registrar.revokeMandate(childNode, bytes32("test"));

        assertEq(
            registrar.getMandate(parentNode).committed, 0, "revoking must free parent headroom"
        );
        assertTrue(registrar.getMandate(childNode).revoked, "child must be marked revoked");

        MandateRegistrar.Mandate memory child = registrar.getMandate(childNode);
        assertEq(
            child.registry.getOwner(child.tokenId),
            address(0),
            "unregistered name must have no owner"
        );
    }

    function test_BindIdentity_WritesErc8004AndModelRecords() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));
        vm.prank(orgAdmin);
        (bytes32 node, address resolverAddr) =
            registrar.issueMandate("research", agentWallet, terms, arcWallet, "[]");

        vm.prank(orgAdmin);
        registrar.bindIdentity(node, 42, "claude-opus-5");

        IPermissionedResolver resolver = IPermissionedResolver(resolverAddr);
        assertEq(resolver.text(node, MandateKeys.ERC8004_ID), "42");
        assertEq(resolver.text(node, MandateKeys.MODEL), "claude-opus-5");
    }
}
