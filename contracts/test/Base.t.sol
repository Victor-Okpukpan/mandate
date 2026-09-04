// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";

import { IVerifiableFactory } from "contracts/interfaces/IVerifiableFactory.sol";
import { LibDNSEncode } from "contracts/libraries/LibDNSEncode.sol";
import { MandateRegistrar } from "contracts/MandateRegistrar.sol";

import { MockVerifiableFactory } from "contracts-test/mocks/MockVerifiableFactory.sol";

/// @title MandateRegistrarTestBase
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Shared setup for the fast, network-independent `MandateRegistrar` test suite. Exercises
///         the registrar's own narrowing/accounting logic against mocks — real ENSv2 integration
///         behavior is covered separately in `test/fork/MandateRegistrarFork.t.sol`.
abstract contract MandateRegistrarTestBase is Test {
    address internal constant USER_REGISTRY_MARKER = address(0x1111);
    address internal constant RESOLVER_MARKER = address(0x2222);

    MandateRegistrar internal registrar;
    MockVerifiableFactory internal factory;

    address internal orgAdmin = makeAddr("orgAdmin");
    address internal agentWallet = makeAddr("agentWallet");
    address internal arcWallet = makeAddr("arcWallet");
    address internal subAgentWallet = makeAddr("subAgentWallet");
    address internal stranger = makeAddr("stranger");

    bytes32 internal orgRootNode;
    bytes internal orgRootDns;

    function setUp() public virtual {
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
    }

    function _defaultTerms(uint64 expiry)
        internal
        pure
        returns (MandateRegistrar.MandateTerms memory)
    {
        return MandateRegistrar.MandateTerms({
            allowlistRoot: keccak256("allowlist-root"),
            budgetTotal: 500_000_000,
            perTxCap: 50_000_000,
            expiry: expiry,
            budgetPeriod: 86_400,
            maxDepth: 2
        });
    }

    function _issueRootMandate(
        string memory label,
        address agent,
        MandateRegistrar.MandateTerms memory terms
    ) internal returns (bytes32 node, address resolver) {
        vm.prank(orgAdmin);
        (node, resolver) = registrar.issueMandate(label, agent, terms, arcWallet, "[]");
    }
}
