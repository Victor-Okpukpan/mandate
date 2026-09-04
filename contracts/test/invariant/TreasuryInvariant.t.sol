// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { StdInvariant, Test } from "forge-std/Test.sol";

import { AgentTreasury } from "contracts/AgentTreasury.sol";
import { MandateAnchor } from "contracts/MandateAnchor.sol";

import { MockERC20 } from "contracts-test/mocks/MockERC20.sol";
import { MockJobs } from "contracts-test/mocks/MockJobs.sol";

import { TreasuryHandler } from "./TreasuryHandler.sol";

/// @title TreasuryInvariantTest
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Plain Foundry stateful invariant tests — `forge-std`'s `StdInvariant`, no external
///         multi-fuzzer harness. Restates mandate.md §12.1's INV-1 and INV-9 for what was
///         actually built: a leaky-bucket budget (not a fixed window) and a revolving credit
///         facility (not a passthrough vault).
///
/// INV-1  For every synced agent, AgentTreasury.spentNow(agent) <= that agent's anchor budgetTotal
///        — i.e. the leaky bucket can decay, but it can never be pushed over the mandate's ceiling
///        by any reachable sequence of payTo calls.
/// INV-9  Treasury solvency: USDC.balanceOf(treasury) + totalDrawn() == totalDeposited() — every
///        unit deposited is always exactly accounted for as either still-liquid or drawn out,
///        across any sequence of deposit/draw/repay/payTo.
contract TreasuryInvariantTest is StdInvariant, Test {
    AgentTreasury internal treasury;
    MandateAnchor internal anchor;
    MockERC20 internal usdc;
    MockJobs internal jobs;
    TreasuryHandler internal handler;

    uint256 internal enforcerKey = 0xE1F0;
    address internal enforcer;
    address internal owner = makeAddr("owner");
    address internal depositor = makeAddr("depositor");
    address internal recipient = makeAddr("recipient");

    address[] internal agents;

    uint128 internal constant BUDGET_TOTAL = 1_000_000e6;
    uint128 internal constant PER_TX_CAP = 100_000e6;

    bytes32 internal constant SYNC_PAYLOAD_TYPEHASH = keccak256(
        "SyncPayload(address agent,bytes32 node,bytes32 termsHash,uint64 expiry,uint128 budgetTotal,uint32 budgetPeriod,uint128 perTxCap,bytes32 allowlistRoot,uint64 nonce,bool revoked)"
    );

    function setUp() public {
        enforcer = vm.addr(enforcerKey);
        usdc = new MockERC20();
        anchor = new MandateAnchor(enforcer, owner, 365 days); // staleness irrelevant to this harness
        jobs = new MockJobs(usdc);

        treasury = new AgentTreasury(
            usdc,
            anchor,
            jobs,
            owner,
            10_000e6, // maxGasFloat
            10_000, // utilisationCapBps: 100%, so the utilisation cap never masks the invariants under test
            0 // interestRateBps: 0, so principal accounting stays exactly traceable
        );

        agents = new address[](3);
        agents[0] = makeAddr("agentA");
        agents[1] = makeAddr("agentB");
        agents[2] = makeAddr("agentC");

        bytes32 allowlistRoot = keccak256(abi.encodePacked(recipient)); // single-leaf: root == leaf
        for (uint256 i; i < agents.length; ++i) {
            _sync(agents[i], allowlistRoot, uint64(i));
        }

        handler = new TreasuryHandler(treasury, usdc, depositor, recipient, agents);
        targetContract(address(handler));
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
                address(anchor)
            )
        );
    }

    function _sync(address agent, bytes32 allowlistRoot, uint64 nonce) internal {
        MandateAnchor.SyncPayload memory p = MandateAnchor.SyncPayload({
            agent: agent,
            node: keccak256(abi.encodePacked("node", agent)),
            termsHash: keccak256("terms"),
            expiry: uint64(block.timestamp + 3650 days), // long-lived: expiry isn't what this harness tests
            budgetTotal: BUDGET_TOTAL,
            budgetPeriod: 0, // lifetime budget: this harness tests the ceiling, not decay timing
            perTxCap: PER_TX_CAP,
            allowlistRoot: allowlistRoot,
            nonce: nonce,
            revoked: false
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(enforcerKey, digest);
        anchor.syncMandate(p, abi.encodePacked(r, s, v));
    }

    /// forge-config: default.invariant.runs = 128
    /// forge-config: default.invariant.depth = 200
    function invariant_SpentNeverExceedsBudget() public view {
        for (uint256 i; i < agents.length; ++i) {
            assertLe(
                treasury.spentNow(agents[i]),
                BUDGET_TOTAL,
                "INV-1: leaky-bucket spend must never exceed the mandate's budgetTotal"
            );
        }
    }

    function invariant_Solvency() public view {
        assertEq(
            usdc.balanceOf(address(treasury)) + treasury.totalDrawn(),
            treasury.totalDeposited(),
            "INV-9: liquid + drawn must always equal deposited"
        );
    }
}
