// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { MandateRegistrar } from "contracts/MandateRegistrar.sol";

import { MandateRegistrarTestBase } from "contracts-test/Base.t.sol";

/// @title AttenuationTest
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Stateless fuzz tests for `MandateRegistrar`'s monotonic-narrowing invariant — the
///         single most important property in the contract: a mandate can only ever delegate a
///         subset of what it itself holds. Mirrors mandate.md §12.1's INV-2/INV-3/INV-4.
contract AttenuationTest is MandateRegistrarTestBase {
    bytes32 internal parentNode;
    MandateRegistrar.MandateTerms internal parentTerms;

    function setUp() public override {
        super.setUp();
        parentTerms = _defaultTerms(uint64(block.timestamp + 30 days));
        (parentNode,) = _issueRootMandate("research", agentWallet, parentTerms);
    }

    /// forge-config: default.fuzz.runs = 1024
    function testFuzz_Attenuate_SucceedsIffWithinEveryParentBound(
        uint128 childBudget,
        uint128 childPerTxCap,
        uint64 childExpiry
    ) public {
        childBudget = uint128(bound(childBudget, 0, type(uint128).max));
        childPerTxCap = uint128(bound(childPerTxCap, 0, type(uint128).max));
        childExpiry = uint64(bound(childExpiry, block.timestamp + 1, type(uint64).max));

        MandateRegistrar.MandateTerms memory childTerms = parentTerms;
        childTerms.budgetTotal = childBudget;
        childTerms.perTxCap = childPerTxCap;
        childTerms.expiry = childExpiry;

        bool withinBudget = childBudget <= parentTerms.budgetTotal; // committed == 0 pre-attenuation
        bool withinCap = childPerTxCap <= parentTerms.perTxCap;
        bool withinExpiry = childExpiry <= parentTerms.expiry;
        bool shouldSucceed = withinBudget && withinCap && withinExpiry;

        vm.prank(agentWallet);
        if (!shouldSucceed) {
            vm.expectRevert();
            registrar.attenuate(parentNode, "scraper", subAgentWallet, childTerms, arcWallet, "[]");
            return;
        }

        (bytes32 childNode,) =
            registrar.attenuate(parentNode, "scraper", subAgentWallet, childTerms, arcWallet, "[]");

        MandateRegistrar.MandateTerms memory stored = registrar.termsOf(childNode);
        assertEq(
            stored.maxDepth, parentTerms.maxDepth - 1, "INV-3: depth must decrement by exactly 1"
        );
        assertEq(
            stored.allowlistRoot,
            parentTerms.allowlistRoot,
            "INV-4: allowlistRoot must be inherited, not caller-supplied"
        );
        assertLe(
            stored.expiry, parentTerms.expiry, "INV-3: child expiry must never exceed parent's"
        );
        assertLe(
            stored.perTxCap,
            parentTerms.perTxCap,
            "INV-3: child perTxCap must never exceed parent's"
        );
        assertEq(
            registrar.getMandate(parentNode).committed,
            childBudget,
            "parent.committed must equal what was just delegated"
        );
    }

    function test_Attenuate_RevertsWhenParentDepthExhausted() public {
        MandateRegistrar.MandateTerms memory leafTerms = parentTerms;
        leafTerms.maxDepth = 0;
        // Issue a fresh root mandate with maxDepth already 0 to isolate this from headroom checks.
        vm.prank(orgAdmin);
        (bytes32 leafNode,) = registrar.issueMandate("ops", agentWallet, leafTerms, arcWallet, "[]");

        MandateRegistrar.MandateTerms memory childTerms = leafTerms;
        childTerms.budgetTotal = 1;

        vm.prank(agentWallet);
        vm.expectRevert(
            abi.encodeWithSelector(
                MandateRegistrar.MandateRegistrar__DepthExhausted.selector, leafNode
            )
        );
        registrar.attenuate(leafNode, "sub", subAgentWallet, childTerms, arcWallet, "[]");
    }

    /// @notice INV-2: sum(children.budgetTotal) <= parent.budgetTotal - parent.committed, always —
    ///         fuzzes a SEQUENCE of attenuate calls against the same parent and checks the running
    ///         total never exceeds the parent's budget, and that the contract itself enforces this
    ///         (a wider request must revert) rather than silently over-committing.
    /// forge-config: default.fuzz.runs = 1024
    function testFuzz_Attenuate_CumulativeChildBudgetsNeverExceedParent(uint128[5] memory rawBudgets)
        public
    {
        uint128 running;
        for (uint256 i; i < rawBudgets.length; ++i) {
            uint128 headroom = parentTerms.budgetTotal - running;
            uint128 requested = uint128(bound(rawBudgets[i], 0, uint256(headroom) + 1_000_000));

            MandateRegistrar.MandateTerms memory childTerms = parentTerms;
            childTerms.budgetTotal = requested;
            string memory label = string.concat("child", vm.toString(i));

            vm.prank(agentWallet);
            if (requested > headroom) {
                vm.expectRevert();
                registrar.attenuate(parentNode, label, subAgentWallet, childTerms, arcWallet, "[]");
            } else {
                registrar.attenuate(parentNode, label, subAgentWallet, childTerms, arcWallet, "[]");
                running += requested;
            }

            assertLe(
                registrar.getMandate(parentNode).committed,
                parentTerms.budgetTotal,
                "INV-2: committed must never exceed the parent's own budget"
            );
        }
    }
}
