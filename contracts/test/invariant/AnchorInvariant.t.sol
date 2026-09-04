// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { StdInvariant, Test } from "forge-std/Test.sol";

import { MandateAnchor } from "contracts/MandateAnchor.sol";

import { AnchorHandler } from "./AnchorHandler.sol";

/// @title AnchorInvariantTest
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Plain Foundry stateful invariant tests for `MandateAnchor`, restating mandate.md
///         §12.1's INV-6 and INV-7 for what was actually built.
///
/// INV-7  For every agent, `anchors(agent).nonce` always equals the highest nonce the handler has
///        ever had successfully accepted by `syncMandate` — proving the contract's own monotonicity
///        guard rejects every replay, skip, or decrease the fuzzer throws at it, across any
///        reachable sequence, not just the unit-tested happy path.
/// INV-6  Fail-closed: for any agent whose anchor is currently revoked, expired, or stale, a
///        zero-amount `assertSpend` against the always-allowlisted recipient must revert. Zero
///        amount and a single-leaf allowlist isolate exactly the property under test — this
///        invariant is not about the per-tx-cap or allowlist checks, which fire first in
///        `assertSpend`'s own revert order and are already covered by the unit suite.
contract AnchorInvariantTest is StdInvariant, Test {
    MandateAnchor internal anchor;
    AnchorHandler internal handler;

    uint256 internal enforcerKey = 0xE1F0;
    address internal enforcerAddr;
    address internal owner = makeAddr("owner");
    address internal recipient = makeAddr("recipient");

    uint64 internal constant MAX_STALENESS = 900; // 15 minutes, matches .env.example's default

    address[] internal agents;

    function setUp() public {
        enforcerAddr = vm.addr(enforcerKey);
        anchor = new MandateAnchor(enforcerAddr, owner, MAX_STALENESS);

        agents = new address[](3);
        agents[0] = makeAddr("agentA");
        agents[1] = makeAddr("agentB");
        agents[2] = makeAddr("agentC");

        handler = new AnchorHandler(anchor, enforcerKey, agents, recipient);
        targetContract(address(handler));
    }

    /// forge-config: default.invariant.runs = 128
    /// forge-config: default.invariant.depth = 200
    function invariant_NonceMonotonic() public view {
        for (uint256 i; i < agents.length; ++i) {
            (,,,,,,, uint64 nonce,) = anchor.anchors(agents[i]);
            assertEq(
                nonce,
                handler.ghostMaxAcceptedNonce(agents[i]),
                "INV-7: on-chain nonce must equal the highest ever-accepted nonce"
            );
        }
    }

    function invariant_FailClosedWhenUnhealthy() public {
        bytes32[] memory emptyProof = new bytes32[](0);

        for (uint256 i; i < agents.length; ++i) {
            address agentAddr = agents[i];
            (,,,, uint64 expiry,, uint64 updatedAt,, bool revoked) = anchor.anchors(agentAddr);

            bool unhealthy = revoked || block.timestamp >= expiry
                || block.timestamp > updatedAt + anchor.maxStaleness();
            if (!unhealthy) continue;

            try anchor.assertSpend(agentAddr, recipient, 0, emptyProof) {
                fail("INV-6: assertSpend must revert for a revoked, expired, or stale anchor");
            } catch { }
        }
    }
}
