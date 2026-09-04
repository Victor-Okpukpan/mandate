// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";
import { Strings } from "openzeppelin-contracts/utils/Strings.sol";

import { MandateRegistrar } from "contracts/MandateRegistrar.sol";

/// @title AttenuationHandler
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Bounded entry points driving `attenuate`/`amendMandate`/`revokeMandate` across a
///         randomized mandate tree rooted at one `issueMandate` call made in the invariant test's
///         own `setUp()`. Every call self-selects its correct on-chain caller (the parent's own
///         agent wallet for `attenuate`, that same wallet for `amendMandate` on a non-root node
///         per `_principalOf`, the org owner for `revokeMandate`) rather than pranking arbitrarily,
///         so a revert means the CONTRACT rejected the attempt, not that the handler misused it.
contract AttenuationHandler is Test {
    using Strings for uint256;

    MandateRegistrar public immutable REGISTRAR;
    address public immutable OWNER;

    bytes32[] internal _nodes;
    mapping(bytes32 node => address) public agentWalletOf;
    mapping(bytes32 node => bytes32) public parentOf;
    uint256 internal _counter;

    constructor(
        MandateRegistrar registrar,
        address owner,
        bytes32 rootNode,
        address rootAgentWallet
    ) {
        REGISTRAR = registrar;
        OWNER = owner;
        _nodes.push(rootNode);
        agentWalletOf[rootNode] = rootAgentWallet;
        parentOf[rootNode] = bytes32(0);
    }

    function nodeCount() external view returns (uint256) {
        return _nodes.length;
    }

    function nodeAt(uint256 index) external view returns (bytes32) {
        return _nodes[index % _nodes.length];
    }

    function _nextWallet() internal returns (address wallet) {
        wallet = address(uint160(uint256(keccak256(abi.encodePacked("agent", ++_counter)))));
    }

    /// @dev Deliberately bounds budget/cap to sometimes exceed the parent's own — the contract, not
    ///      the handler, must be what turns those attempts away.
    function attenuate(
        uint256 parentIndex,
        uint128 budgetTotal,
        uint128 perTxCap,
        uint64 expiryOffset
    ) external {
        bytes32 parentNode = _nodes[parentIndex % _nodes.length];
        MandateRegistrar.Mandate memory parent = REGISTRAR.getMandate(parentNode);
        if (parent.revoked || parent.terms.expiry <= block.timestamp) return;

        expiryOffset = uint64(bound(expiryOffset, 1, 3650 days));
        budgetTotal = uint128(bound(budgetTotal, 0, uint256(parent.terms.budgetTotal) + 1));
        perTxCap = uint128(bound(perTxCap, 0, uint256(parent.terms.perTxCap) + 1));

        address subAgent = _nextWallet();
        string memory label = string.concat("m", (++_counter).toString());

        MandateRegistrar.MandateTerms memory terms = MandateRegistrar.MandateTerms({
            allowlistRoot: bytes32(0),
            budgetTotal: budgetTotal,
            perTxCap: perTxCap,
            expiry: uint64(block.timestamp) + expiryOffset,
            budgetPeriod: 0,
            maxDepth: 0
        });

        vm.prank(agentWalletOf[parentNode]);
        try REGISTRAR.attenuate(parentNode, label, subAgent, terms, subAgent, "") returns (
            bytes32 node, address
        ) {
            _nodes.push(node);
            agentWalletOf[node] = subAgent;
            parentOf[node] = parentNode;
        } catch { }
    }

    function amend(uint256 nodeIndex, uint128 budgetTotal, uint128 perTxCap, uint64 expiryOffset)
        external
    {
        bytes32 node = _nodes[nodeIndex % _nodes.length];
        bytes32 parentNode = parentOf[node];
        address caller = parentNode == bytes32(0) ? OWNER : agentWalletOf[parentNode];

        expiryOffset = uint64(bound(expiryOffset, 1, 3650 days));
        MandateRegistrar.MandateTerms memory terms = MandateRegistrar.MandateTerms({
            allowlistRoot: bytes32(0),
            budgetTotal: budgetTotal,
            perTxCap: perTxCap,
            expiry: uint64(block.timestamp) + expiryOffset,
            budgetPeriod: 0,
            maxDepth: 0
        });

        vm.prank(caller);
        try REGISTRAR.amendMandate(node, terms) { } catch { }
    }

    /// @dev Always fired as the org owner, who can revoke anywhere in the tree — the point of this
    ///      handler is exercising the allocation/narrowing invariants under churn, not re-testing
    ///      the caller-authorization matrix already covered by the unit suite.
    function revoke(uint256 nodeIndex, bytes32 reason) external {
        bytes32 node = _nodes[nodeIndex % _nodes.length];
        vm.prank(OWNER);
        try REGISTRAR.revokeMandate(node, reason) { } catch { }
    }

    function warp(uint256 secondsForward) external {
        secondsForward = bound(secondsForward, 0, 30 days);
        vm.warp(block.timestamp + secondsForward);
    }
}
