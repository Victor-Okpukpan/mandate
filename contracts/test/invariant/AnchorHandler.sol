// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";

import { MandateAnchor } from "contracts/MandateAnchor.sol";

/// @title AnchorHandler
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Bounded entry points for the invariant fuzzer to call against `MandateAnchor`. Holds
///         the Enforcer's own private key (the test's, not a secret in production) so it can sign
///         a validly-formed EIP-712 payload for whatever random fields the fuzzer chooses — the
///         property under test is whether the CONTRACT correctly rejects a bad nonce, not whether
///         signing works.
contract AnchorHandler is Test {
    MandateAnchor public immutable ANCHOR;
    uint256 internal immutable ENFORCER_KEY;
    /// @dev Fixed recipient whose leaf every synced anchor's `allowlistRoot` is set to (a
    ///      single-leaf tree, root == leaf) — so `assertSpend(agent, RECIPIENT, 0, [])` always
    ///      clears the allowlist check regardless of when an agent was synced, isolating the
    ///      staleness/revocation/expiry checks the invariant actually targets.
    address internal immutable RECIPIENT;
    address[] internal _agents;

    bytes32 internal constant SYNC_PAYLOAD_TYPEHASH = keccak256(
        "SyncPayload(address agent,bytes32 node,bytes32 termsHash,uint64 expiry,uint128 budgetTotal,uint32 budgetPeriod,uint128 perTxCap,bytes32 allowlistRoot,uint64 nonce,bool revoked)"
    );
    bytes32 internal constant HEARTBEAT_TYPEHASH =
        keccak256("HeartbeatPayload(address agent,uint64 deadline)");

    /// @dev The highest nonce EVER successfully accepted per agent — since `syncMandate` can only
    ///      move a nonce forward or reject it outright, this is exactly what the anchor's own
    ///      stored nonce should equal after any sequence of calls, valid or adversarial.
    mapping(address agent => uint64) public ghostMaxAcceptedNonce;

    constructor(
        MandateAnchor anchor,
        uint256 enforcerKey,
        address[] memory agents,
        address recipient
    ) {
        ANCHOR = anchor;
        ENFORCER_KEY = enforcerKey;
        _agents = agents;
        RECIPIENT = recipient;
    }

    function agentCount() external view returns (uint256) {
        return _agents.length;
    }

    function agentAt(uint256 index) public view returns (address) {
        return _agents[index % _agents.length];
    }

    function recipient() external view returns (address) {
        return RECIPIENT;
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("MandateAnchor")),
                keccak256(bytes("1")),
                block.chainid,
                address(ANCHOR)
            )
        );
    }

    /// @dev Deliberately does NOT bound `nonce` to "the next valid one" — the fuzzer is free to
    ///      try replays, skips, and decreases, all validly signed. That's the point.
    function syncMandate(
        uint256 agentIndex,
        uint64 nonce,
        bool revoked,
        uint128 budgetTotal,
        uint128 perTxCap,
        uint64 expiryOffset
    ) external {
        address agent = agentAt(agentIndex);
        expiryOffset = uint64(bound(expiryOffset, 1, 3650 days));

        MandateAnchor.SyncPayload memory p = MandateAnchor.SyncPayload({
            agent: agent,
            node: keccak256(abi.encodePacked("node", agent)),
            termsHash: keccak256("terms"),
            expiry: uint64(block.timestamp + expiryOffset),
            budgetTotal: budgetTotal,
            budgetPeriod: 0,
            perTxCap: perTxCap,
            allowlistRoot: keccak256(abi.encodePacked(RECIPIENT)),
            nonce: nonce,
            revoked: revoked
        });
        bytes32 structHash = keccak256(
            abi.encode(
                SYNC_PAYLOAD_TYPEHASH,
                p.agent,
                p.node,
                p.termsHash,
                p.expiry,
                p.budgetTotal,
                p.budgetPeriod,
                p.perTxCap,
                p.allowlistRoot,
                p.nonce,
                p.revoked
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ENFORCER_KEY, digest);

        try ANCHOR.syncMandate(p, abi.encodePacked(r, s, v)) {
            if (nonce > ghostMaxAcceptedNonce[agent]) {
                ghostMaxAcceptedNonce[agent] = nonce;
            }
        } catch { }
    }

    function heartbeat(uint256 agentIndex, uint64 deadlineOffset) external {
        address agent = agentAt(agentIndex);
        deadlineOffset = uint64(bound(deadlineOffset, 0, 2 days));
        uint64 deadline = uint64(block.timestamp) + deadlineOffset;

        bytes32 structHash = keccak256(abi.encode(HEARTBEAT_TYPEHASH, agent, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ENFORCER_KEY, digest);

        try ANCHOR.heartbeat(agent, deadline, abi.encodePacked(r, s, v)) { } catch { }
    }

    /// @dev Lets the fuzzer explore staleness by advancing time — bounded so a single call can't
    ///      jump centuries ahead and make every later call meaningless.
    function warp(uint256 secondsForward) external {
        secondsForward = bound(secondsForward, 0, 2 days);
        vm.warp(block.timestamp + secondsForward);
    }
}
