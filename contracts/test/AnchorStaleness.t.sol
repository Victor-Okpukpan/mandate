// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";

import { MandateAnchor } from "contracts/MandateAnchor.sol";

/// @title AnchorStalenessTest
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Covers mandate.md §12.1's INV-5 (revoked ⇒ every spend reverts), INV-6 (stale ⇒ every
///         spend reverts — the fail-closed property), and INV-7 (nonce is strictly monotonic; no
///         replay of an older SyncPayload succeeds).
/// branching tree — target: assertSpend
/// ├── given the anchor is revoked
/// │   └── it should revert, regardless of every other field
/// ├── given block.timestamp >= anchor.expiry
/// │   └── it should revert
/// ├── given amount > anchor.perTxCap
/// │   └── it should revert
/// ├── given the recipient is not in the allowlist
/// │   └── it should revert
/// ├── given block.timestamp > anchor.updatedAt + maxStaleness
/// │   └── it should revert — fail closed, even with a perfectly valid mandate otherwise
/// └── given none of the above
///     └── it should not revert
contract AnchorStalenessTest is Test {
    MandateAnchor internal anchor;

    uint256 internal enforcerKey = 0xE1F0;
    address internal enforcer;
    address internal owner = makeAddr("owner");
    address internal agent = makeAddr("agent");
    address internal recipient = makeAddr("recipient");

    uint64 internal constant MAX_STALENESS = 15 minutes;

    bytes32 internal constant SYNC_PAYLOAD_TYPEHASH = keccak256(
        "SyncPayload(address agent,bytes32 node,bytes32 termsHash,uint64 expiry,uint128 budgetTotal,uint32 budgetPeriod,uint128 perTxCap,bytes32 allowlistRoot,uint64 nonce,bool revoked)"
    );
    bytes32 internal constant HEARTBEAT_TYPEHASH =
        keccak256("HeartbeatPayload(address agent,uint64 deadline)");

    function setUp() public {
        enforcer = vm.addr(enforcerKey);
        anchor = new MandateAnchor(enforcer, owner, MAX_STALENESS);
    }

    /*//////////////////////////////////////////////////////////////
                                  HELPERS
    //////////////////////////////////////////////////////////////*/

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("MandateAnchor")),
                keccak256(bytes("1")),
                block.chainid,
                address(anchor)
            )
        );
    }

    function _signSync(MandateAnchor.SyncPayload memory p, uint256 signerKey)
        internal
        view
        returns (bytes memory)
    {
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signHeartbeat(address who, uint64 deadline, uint256 signerKey)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(abi.encode(HEARTBEAT_TYPEHASH, who, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _validPayload(uint64 nonce, bool revoked)
        internal
        view
        returns (MandateAnchor.SyncPayload memory)
    {
        address[] memory allowed = new address[](1);
        allowed[0] = recipient;
        return MandateAnchor.SyncPayload({
            agent: agent,
            node: keccak256("research.acme.eth"),
            termsHash: keccak256("terms"),
            expiry: uint64(block.timestamp + 7 days),
            budgetTotal: 500_000_000,
            budgetPeriod: 86_400,
            perTxCap: 50_000_000,
            allowlistRoot: keccak256(abi.encodePacked(recipient)), // single-leaf tree: root == leaf
            nonce: nonce,
            revoked: revoked
        });
    }

    function _sync(uint64 nonce, bool revoked) internal {
        MandateAnchor.SyncPayload memory p = _validPayload(nonce, revoked);
        anchor.syncMandate(p, _signSync(p, enforcerKey));
    }

    /*//////////////////////////////////////////////////////////////
                              SYNCMANDATE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SyncMandate_RevertsOnWrongSigner() public {
        uint256 strangerKey = 0xBAD;
        MandateAnchor.SyncPayload memory p = _validPayload(1, false);
        vm.expectRevert(MandateAnchor.MandateAnchor__InvalidSignature.selector);
        anchor.syncMandate(p, _signSync(p, strangerKey));
    }

    /// INV-7: nonce is strictly monotonic.
    function test_SyncMandate_RevertsOnNonceReplay() public {
        _sync(5, false);
        vm.expectRevert(
            abi.encodeWithSelector(MandateAnchor.MandateAnchor__NonceNotMonotonic.selector, 5, 5)
        );
        _sync(5, false);
    }

    function test_SyncMandate_RevertsOnOutOfOrderNonce() public {
        _sync(10, false);
        vm.expectRevert(
            abi.encodeWithSelector(MandateAnchor.MandateAnchor__NonceNotMonotonic.selector, 3, 10)
        );
        _sync(3, false);
    }

    function test_SyncMandate_FirstSyncAcceptsAnyStartingNonce() public {
        _sync(0, false);
        (,,,,,,, uint64 nonce,) = anchor.anchors(agent);
        assertEq(nonce, 0);
    }

    /*//////////////////////////////////////////////////////////////
                              ASSERTSPEND TESTS
    //////////////////////////////////////////////////////////////*/

    /// INV-5: revoked ⇒ every spend reverts.
    function test_AssertSpend_RevertsWhenRevoked() public {
        _sync(1, true);
        bytes32[] memory proof = new bytes32[](0);
        vm.expectRevert(
            abi.encodeWithSelector(MandateAnchor.MandateAnchor__Revoked.selector, agent)
        );
        anchor.assertSpend(agent, recipient, 1_000_000, proof);
    }

    function test_AssertSpend_RevertsWhenExpired() public {
        MandateAnchor.SyncPayload memory p = _validPayload(1, false);
        p.expiry = uint64(block.timestamp + 1);
        anchor.syncMandate(p, _signSync(p, enforcerKey));

        vm.warp(block.timestamp + 2);
        bytes32[] memory proof = new bytes32[](0);
        vm.expectRevert(
            abi.encodeWithSelector(MandateAnchor.MandateAnchor__Expired.selector, agent, p.expiry)
        );
        anchor.assertSpend(agent, recipient, 1_000_000, proof);
    }

    function test_AssertSpend_RevertsOverPerTxCap() public {
        _sync(1, false);
        bytes32[] memory proof = new bytes32[](0);
        vm.expectRevert(
            abi.encodeWithSelector(
                MandateAnchor.MandateAnchor__PerTxCapExceeded.selector, 50_000_001, 50_000_000
            )
        );
        anchor.assertSpend(agent, recipient, 50_000_001, proof);
    }

    function test_AssertSpend_RevertsWhenRecipientNotAllowlisted() public {
        _sync(1, false);
        bytes32[] memory proof = new bytes32[](0);
        address stranger = makeAddr("notAllowed");
        vm.expectRevert(
            abi.encodeWithSelector(MandateAnchor.MandateAnchor__NotAllowlisted.selector, stranger)
        );
        anchor.assertSpend(agent, stranger, 1_000_000, proof);
    }

    /// INV-6: stale ⇒ every spend reverts, even with an otherwise perfectly valid mandate. The
    /// best security property in the project: a dead Enforcer freezes agents, it doesn't free them.
    function test_AssertSpend_FailsClosedWhenStale() public {
        _sync(1, false);
        bytes32[] memory proof = new bytes32[](0);

        // Valid right after sync.
        anchor.assertSpend(agent, recipient, 1_000_000, proof);

        vm.warp(block.timestamp + MAX_STALENESS + 1);
        vm.expectRevert(); // MandateAnchor__Stale — dynamic updatedAt makes selector-only assertion simpler here
        anchor.assertSpend(agent, recipient, 1_000_000, proof);
    }

    function test_AssertSpend_SucceedsRightAtStalenessBoundary() public {
        _sync(1, false);
        bytes32[] memory proof = new bytes32[](0);
        vm.warp(block.timestamp + MAX_STALENESS);
        anchor.assertSpend(agent, recipient, 1_000_000, proof); // == boundary, not yet stale
    }

    /*//////////////////////////////////////////////////////////////
                              HEARTBEAT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Heartbeat_ExtendsLivenessWithoutTouchingTerms() public {
        _sync(1, false);
        bytes32[] memory proof = new bytes32[](0);

        vm.warp(block.timestamp + MAX_STALENESS - 1);
        uint64 deadline = uint64(block.timestamp + 5 minutes);
        anchor.heartbeat(agent, deadline, _signHeartbeat(agent, deadline, enforcerKey));

        // Would have gone stale by now without the heartbeat.
        vm.warp(block.timestamp + MAX_STALENESS - 1);
        anchor.assertSpend(agent, recipient, 1_000_000, proof); // still alive

        (bytes32 termsHash,,,,,,,,) = anchor.anchors(agent);
        assertEq(termsHash, keccak256("terms"), "heartbeat must not touch terms");
    }

    function test_Heartbeat_RevertsPastDeadline() public {
        _sync(1, false);
        uint64 deadline = uint64(block.timestamp - 1);
        vm.expectRevert(MandateAnchor.MandateAnchor__InvalidSignature.selector);
        anchor.heartbeat(agent, deadline, _signHeartbeat(agent, deadline, enforcerKey));
    }

    function test_Heartbeat_RevertsOnWrongSigner() public {
        uint64 deadline = uint64(block.timestamp + 5 minutes);
        vm.expectRevert(MandateAnchor.MandateAnchor__InvalidSignature.selector);
        anchor.heartbeat(agent, deadline, _signHeartbeat(agent, deadline, 0xBAD));
    }

    /*//////////////////////////////////////////////////////////////
                          ENFORCER TIMELOCK TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ExecuteEnforcerChange_RevertsBeforeTimelockElapses() public {
        address newEnforcer = makeAddr("newEnforcer");
        vm.prank(owner);
        anchor.proposeEnforcer(newEnforcer);

        vm.prank(owner);
        vm.expectRevert();
        anchor.executeEnforcerChange();
    }

    function test_ExecuteEnforcerChange_SucceedsAfterDelay() public {
        address newEnforcer = makeAddr("newEnforcer");
        vm.prank(owner);
        anchor.proposeEnforcer(newEnforcer);

        vm.warp(block.timestamp + anchor.ENFORCER_CHANGE_DELAY());
        vm.prank(owner);
        anchor.executeEnforcerChange();

        assertEq(anchor.enforcer(), newEnforcer);
    }

    function test_ProposeEnforcer_RevertsWhenCallerIsNotOwner() public {
        vm.expectRevert();
        anchor.proposeEnforcer(makeAddr("newEnforcer"));
    }
}
