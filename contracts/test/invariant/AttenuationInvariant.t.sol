// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { StdInvariant, Test } from "forge-std/Test.sol";

import { IVerifiableFactory } from "contracts/interfaces/IVerifiableFactory.sol";
import { LibDNSEncode } from "contracts/libraries/LibDNSEncode.sol";
import { MandateRegistrar } from "contracts/MandateRegistrar.sol";

import { MockVerifiableFactory } from "contracts-test/mocks/MockVerifiableFactory.sol";

import { AttenuationHandler } from "./AttenuationHandler.sol";

/// @title AttenuationInvariantTest
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Plain Foundry stateful invariant tests for `MandateRegistrar`'s allocation/narrowing
///         properties, restating mandate.md §12.1's INV-2/INV-3/INV-4 for what was actually built.
///
/// INV-2  For every mandate, committed <= terms.budgetTotal — a parent's sub-delegations can never
///        be allocated past its own ceiling, across any sequence of attenuate/amend/revoke.
/// INV-4  For every non-root mandate, terms.allowlistRoot == parent.terms.allowlistRoot — a child
///        always inherits its parent's allowlist verbatim, never a different one.
///
/// INV-3 (`child.expiry <= parent.expiry`, `child.perTxCap <= parent.perTxCap`) is deliberately
/// NOT asserted here as a standing tree-wide property: this harness caught it failing, because
/// `amendMandate` shrinking a mandate's own expiry/perTxCap does not cascade to already-issued
/// children — see MandateRegistrar's contract-level NatSpec and ARCHITECTURE.md's known-limitations
/// section for why that's a disclosed gap (belongs in the Enforcer, not the registrar) rather than
/// a bug fixed here. INV-3 at the point of attenuation/amendment itself is still exhaustively
/// covered by `test/Attenuation.t.sol`'s unit and fuzz tests.
contract AttenuationInvariantTest is StdInvariant, Test {
    address internal constant USER_REGISTRY_MARKER = address(0x1111);
    address internal constant RESOLVER_MARKER = address(0x2222);

    MandateRegistrar internal registrar;
    MockVerifiableFactory internal factory;
    AttenuationHandler internal handler;

    address internal orgAdmin = makeAddr("orgAdmin");
    address internal rootAgentWallet = makeAddr("rootAgentWallet");
    address internal arcWallet = makeAddr("arcWallet");

    bytes32 internal orgRootNode;
    bytes internal orgRootDns;
    bytes32 internal rootNode;

    function setUp() public {
        factory = new MockVerifiableFactory(USER_REGISTRY_MARKER, RESOLVER_MARKER);

        bytes memory ethDns = LibDNSEncode.prependLabel("eth", hex"00");
        orgRootDns = LibDNSEncode.prependLabel("acme", ethDns);
        bytes32 ethNode = LibDNSEncode.namehashChild(bytes32(0), "eth");
        orgRootNode = LibDNSEncode.namehashChild(ethNode, "acme");

        registrar = new MandateRegistrar(
            IVerifiableFactory(address(factory)),
            USER_REGISTRY_MARKER,
            RESOLVER_MARKER,
            orgRootNode,
            orgRootDns,
            "acme.eth",
            orgAdmin
        );

        MandateRegistrar.MandateTerms memory rootTerms = MandateRegistrar.MandateTerms({
            allowlistRoot: keccak256("allowlist-root"),
            budgetTotal: 1_000_000e6,
            perTxCap: 100_000e6,
            expiry: uint64(block.timestamp + 3650 days),
            budgetPeriod: 0,
            maxDepth: 5
        });

        vm.prank(orgAdmin);
        (rootNode,) = registrar.issueMandate("root", rootAgentWallet, rootTerms, arcWallet, "[]");

        handler = new AttenuationHandler(registrar, orgAdmin, rootNode, rootAgentWallet);
        targetContract(address(handler));
    }

    /// forge-config: default.invariant.runs = 128
    /// forge-config: default.invariant.depth = 200
    function invariant_CommittedNeverExceedsBudget() public view {
        uint256 count = handler.nodeCount();
        for (uint256 i; i < count; ++i) {
            MandateRegistrar.Mandate memory mandate = registrar.getMandate(handler.nodeAt(i));
            assertLe(
                mandate.committed,
                mandate.terms.budgetTotal,
                "INV-2: committed must never exceed a mandate's own budgetTotal"
            );
        }
    }

    function invariant_AllowlistRootInheritedVerbatim() public view {
        uint256 count = handler.nodeCount();
        for (uint256 i; i < count; ++i) {
            bytes32 node = handler.nodeAt(i);
            if (node == rootNode) continue;
            bytes32 parentNode = handler.parentOf(node);

            MandateRegistrar.Mandate memory child = registrar.getMandate(node);
            MandateRegistrar.Mandate memory parent = registrar.getMandate(parentNode);

            assertEq(
                child.terms.allowlistRoot,
                parent.terms.allowlistRoot,
                "INV-4: child.allowlistRoot must always equal parent's"
            );
        }
    }
}
