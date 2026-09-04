// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { IPermissionedResolver } from "contracts/interfaces/IPermissionedResolver.sol";
import { MandateKeys } from "contracts/libraries/MandateKeys.sol";
import { MandateRegistrar } from "contracts/MandateRegistrar.sol";

import { MandateRegistrarTestBase } from "contracts-test/Base.t.sol";

/// @title MandateRegistrarTest
/// @author Victor Okpukpan (@victorokpukpan_)
/// branching tree — target: issueMandate
/// ├── when caller is not the owner
/// │   └── it should revert
/// └── when caller is the owner
///     ├── given agentWallet or arcWallet is the zero address
///     │   └── it should revert
///     ├── given terms.expiry is not in the future
///     │   └── it should revert
///     └── given all inputs are valid
///         ├── it should mint the name to agentWallet
///         ├── it should deploy a dedicated resolver with mandate.* records set
///         └── it should authorize only the agent.* keys for agentWallet
///
/// branching tree — target: revokeMandate
/// ├── when caller is neither the owner nor the immediate parent's agent
/// │   └── it should revert
/// └── when caller is authorized
///     ├── given the mandate is already revoked
///     │   └── it should revert
///     └── given the mandate is live
///         ├── it should mark the mandate revoked
///         ├── it should unregister the underlying name
///         └── it should free the parent's committed headroom, if any
contract MandateRegistrarTest is MandateRegistrarTestBase {
    function test_IssueMandate_RevertsWhenCallerIsNotOwner() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));
        vm.prank(stranger);
        vm.expectRevert();
        registrar.issueMandate("research", agentWallet, terms, arcWallet, "[]");
    }

    function test_IssueMandate_RevertsOnZeroAgentWallet() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));
        vm.prank(orgAdmin);
        vm.expectRevert(MandateRegistrar.MandateRegistrar__ZeroAddress.selector);
        registrar.issueMandate("research", address(0), terms, arcWallet, "[]");
    }

    function test_IssueMandate_RevertsOnPastExpiry() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp));
        vm.prank(orgAdmin);
        vm.expectRevert(
            abi.encodeWithSelector(
                MandateRegistrar.MandateRegistrar__ExpiryInPast.selector, terms.expiry
            )
        );
        registrar.issueMandate("research", agentWallet, terms, arcWallet, "[]");
    }

    function test_IssueMandate_MintsToAgentAndWritesRecords() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));
        (bytes32 node, address resolverAddr) = _issueRootMandate("research", agentWallet, terms);

        MandateRegistrar.Mandate memory mandate = registrar.getMandate(node);
        assertEq(mandate.agentWallet, agentWallet);
        assertEq(mandate.parentNode, bytes32(0));
        assertFalse(mandate.revoked);

        IPermissionedResolver resolver = IPermissionedResolver(resolverAddr);
        assertEq(resolver.text(node, MandateKeys.BUDGET_TOTAL), "500000000");
        assertEq(resolver.text(node, MandateKeys.PRINCIPAL), "acme.eth");
    }

    function test_IssueMandate_RevertsOnDuplicateLabel() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));
        _issueRootMandate("research", agentWallet, terms);

        vm.prank(orgAdmin);
        vm.expectRevert();
        registrar.issueMandate("research", agentWallet, terms, arcWallet, "[]");
    }

    function test_RevokeMandate_RevertsWhenCallerIsUnauthorized() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));
        (bytes32 node,) = _issueRootMandate("research", agentWallet, terms);

        vm.prank(stranger);
        vm.expectRevert();
        registrar.revokeMandate(node, bytes32("reason"));
    }

    function test_RevokeMandate_RevertsWhenAlreadyRevoked() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));
        (bytes32 node,) = _issueRootMandate("research", agentWallet, terms);

        vm.prank(orgAdmin);
        registrar.revokeMandate(node, bytes32("reason"));

        vm.prank(orgAdmin);
        vm.expectRevert(
            abi.encodeWithSelector(MandateRegistrar.MandateRegistrar__MandateRevoked.selector, node)
        );
        registrar.revokeMandate(node, bytes32("reason"));
    }

    function test_RevokeMandate_ByImmediateParentAgent() public {
        MandateRegistrar.MandateTerms memory parentTerms =
            _defaultTerms(uint64(block.timestamp + 7 days));
        (bytes32 parentNode,) = _issueRootMandate("research", agentWallet, parentTerms);

        MandateRegistrar.MandateTerms memory childTerms =
            _defaultTerms(uint64(block.timestamp + 7 days));
        childTerms.budgetTotal = 1_000_000;
        vm.prank(agentWallet);
        (bytes32 childNode,) =
            registrar.attenuate(parentNode, "scraper", subAgentWallet, childTerms, arcWallet, "[]");

        // The sub-agent's own principal (parent's agent) can revoke it without org involvement.
        vm.prank(agentWallet);
        registrar.revokeMandate(childNode, bytes32("fired"));
        assertTrue(registrar.getMandate(childNode).revoked);
    }

    function test_AmendMandate_UpdatesTermsAndRecords() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));
        (bytes32 node, address resolverAddr) = _issueRootMandate("research", agentWallet, terms);

        MandateRegistrar.MandateTerms memory amended = terms;
        amended.budgetTotal = 750_000_000;

        vm.prank(orgAdmin);
        registrar.amendMandate(node, amended);

        assertEq(registrar.termsOf(node).budgetTotal, 750_000_000);
        assertEq(
            IPermissionedResolver(resolverAddr).text(node, MandateKeys.BUDGET_TOTAL), "750000000"
        );
    }

    function test_AmendMandate_RevertsWhenCallerIsNotPrincipal() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));
        (bytes32 node,) = _issueRootMandate("research", agentWallet, terms);

        vm.prank(stranger);
        vm.expectRevert();
        registrar.amendMandate(node, terms);
    }

    function test_BindIdentity_OnlyPrincipal() public {
        MandateRegistrar.MandateTerms memory terms = _defaultTerms(uint64(block.timestamp + 7 days));
        (bytes32 node,) = _issueRootMandate("research", agentWallet, terms);

        vm.prank(stranger);
        vm.expectRevert();
        registrar.bindIdentity(node, 1, "model");

        vm.prank(orgAdmin);
        registrar.bindIdentity(node, 7, "claude-opus-5");
        // No revert — principal (org admin, for a root mandate) succeeds.
    }
}
