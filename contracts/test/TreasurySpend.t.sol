// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";

import { AgentTreasury } from "contracts/AgentTreasury.sol";
import { MandateAnchor } from "contracts/MandateAnchor.sol";

import { MockERC20 } from "contracts-test/mocks/MockERC20.sol";
import { MockJobs } from "contracts-test/mocks/MockJobs.sol";

/// @title TreasurySpendTest
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Covers `AgentTreasury`'s two corrected designs (typed spend paths; leaky-bucket budget)
///         and mandate.md §12.1's INV-1 (spentInWindow <= budgetTotal, restated here as the
///         leaky-bucket accumulator) and INV-9 (treasury solvency).
/// branching tree — target: payTo
/// ├── given MandateAnchor.assertSpend would revert
/// │   └── it should revert, propagating the reason
/// ├── given the leaky-bucket-decayed spend + amount exceeds the mandate's budgetTotal
/// │   └── it should revert, even if assertSpend alone would allow it
/// ├── given the draw would exceed the pool's utilisation cap
/// │   └── it should revert
/// └── given none of the above
///     ├── it should transfer `amount` USDC to `to`
///     ├── it should increase the agent's principal by `amount`
///     └── it should increase the agent's leaky-bucket accumulator by `amount`
contract TreasurySpendTest is Test {
    AgentTreasury internal treasury;
    MandateAnchor internal anchor;
    MockERC20 internal usdc;
    MockJobs internal jobs;

    uint256 internal enforcerKey = 0xE1F0;
    address internal enforcer;
    address internal owner = makeAddr("owner");
    address internal agent = makeAddr("agent");
    address internal recipient = makeAddr("recipient");
    address internal depositor = makeAddr("depositor");

    uint128 internal constant BUDGET_TOTAL = 500_000_000; // 500 USDC
    uint128 internal constant PER_TX_CAP = 50_000_000; // 50 USDC
    uint32 internal constant BUDGET_PERIOD = 86_400; // 1 day
    uint64 internal constant MAX_STALENESS = 15 minutes;

    bytes32 internal constant SYNC_PAYLOAD_TYPEHASH = keccak256(
        "SyncPayload(address agent,bytes32 node,bytes32 termsHash,uint64 expiry,uint128 budgetTotal,uint32 budgetPeriod,uint128 perTxCap,bytes32 allowlistRoot,uint64 nonce,bool revoked)"
    );

    function setUp() public {
        enforcer = vm.addr(enforcerKey);
        usdc = new MockERC20();
        anchor = new MandateAnchor(enforcer, owner, MAX_STALENESS);
        jobs = new MockJobs(usdc);

        treasury = new AgentTreasury(
            usdc,
            anchor,
            jobs,
            owner,
            5_000_000, // maxGasFloat: 5 USDC
            8_000, // utilisationCapBps: 80%
            1_000 // interestRateBps: 10% APY
        );

        // Fund and sync the agent's mandate: budget 500 USDC, 50 USDC/tx, recipient allowlisted.
        _syncAgent(_singleLeafRoot(recipient), 1, false);

        usdc.mint(depositor, 1_000_000_000);
        vm.startPrank(depositor);
        usdc.approve(address(treasury), type(uint256).max);
        treasury.deposit(1_000_000_000); // 1000 USDC pool
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                                  HELPERS
    //////////////////////////////////////////////////////////////*/

    function _singleLeafRoot(address only) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(only)); // single-leaf tree: root == leaf
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

    function _syncAgent(bytes32 allowlistRoot, uint64 nonce, bool revoked) internal {
        _syncAgent(allowlistRoot, nonce, revoked, BUDGET_PERIOD);
    }

    function _syncAgent(bytes32 allowlistRoot, uint64 nonce, bool revoked, uint32 budgetPeriod)
        internal
    {
        MandateAnchor.SyncPayload memory p = MandateAnchor.SyncPayload({
            agent: agent,
            node: keccak256("research.acme.eth"),
            termsHash: keccak256("terms"),
            expiry: uint64(block.timestamp + 30 days),
            budgetTotal: BUDGET_TOTAL,
            budgetPeriod: budgetPeriod,
            perTxCap: PER_TX_CAP,
            allowlistRoot: allowlistRoot,
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(enforcerKey, digest);
        anchor.syncMandate(p, abi.encodePacked(r, s, v));
    }

    function _emptyProof() internal pure returns (bytes32[] memory) {
        return new bytes32[](0);
    }

    /// @dev Spends exactly `total` from the pool to `recipient`, as `agent`, in PER_TX_CAP-sized
    ///      chunks — `total` must divide evenly by PER_TX_CAP. Caller must already be pranked.
    function _spendInChunks(uint256 total) internal {
        uint256 remaining = total;
        while (remaining > 0) {
            uint256 chunk = remaining > PER_TX_CAP ? PER_TX_CAP : remaining;
            treasury.payTo(recipient, chunk, _emptyProof());
            remaining -= chunk;
        }
    }

    /*//////////////////////////////////////////////////////////////
                              DEPOSIT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Deposit_IncreasesPoolAndAccounting() public {
        assertEq(treasury.totalDeposited(), 1_000_000_000);
        assertEq(usdc.balanceOf(address(treasury)), 1_000_000_000);
    }

    /*//////////////////////////////////////////////////////////////
                              PAYTO TESTS
    //////////////////////////////////////////////////////////////*/

    function test_PayTo_TransfersAndUpdatesAccounting() public {
        vm.prank(agent);
        treasury.payTo(recipient, 10_000_000, _emptyProof());

        assertEq(usdc.balanceOf(recipient), 10_000_000);
        (uint128 spentAccum, uint128 principal,,) = treasury.accounts(agent);
        assertEq(spentAccum, 10_000_000);
        assertEq(principal, 10_000_000);
    }

    function test_PayTo_PropagatesAssertSpendRevertOnUnallowlistedRecipient() public {
        address stranger = makeAddr("stranger");
        vm.prank(agent);
        vm.expectRevert();
        treasury.payTo(stranger, 1_000_000, _emptyProof());
    }

    function test_PayTo_RevertsOverPerTxCapViaAssertSpend() public {
        vm.prank(agent);
        vm.expectRevert();
        treasury.payTo(recipient, PER_TX_CAP + 1, _emptyProof());
    }

    /// INV-1 restated for the leaky bucket: cumulative spend can never exceed budgetTotal, even
    /// spread across many under-the-per-tx-cap payments that `assertSpend` alone would each allow.
    function test_PayTo_RevertsWhenCumulativeBudgetExceeded() public {
        vm.startPrank(agent);
        for (uint256 i; i < 10; ++i) {
            treasury.payTo(recipient, PER_TX_CAP, _emptyProof()); // 10 x 50 = 500 = budgetTotal
        }
        vm.expectRevert();
        treasury.payTo(recipient, 1, _emptyProof()); // one more unit tips it over
        vm.stopPrank();
    }

    function test_PayTo_LeakyBucketDecaysOverBudgetPeriod() public {
        // Isolate budget decay from the pool's utilisation cap (covered separately by
        // test_PayTo_RevertsOverUtilisationCap) and from interest accrual (covered separately by
        // the Accrue tests): spending the same budget twice, even after it decays, still leaves
        // twice as much drawn from the pool plus a day of interest — real, correct interactions
        // with the other caps, not something this test means to exercise.
        vm.startPrank(owner);
        treasury.setUtilisationCap(10_000);
        treasury.setInterestRate(0);
        vm.stopPrank();

        vm.startPrank(agent);
        _spendInChunks(BUDGET_TOTAL); // fully spent, 10 x 50 USDC

        vm.expectRevert();
        treasury.payTo(recipient, 1, _emptyProof()); // no headroom left yet
        vm.stopPrank();

        // BUDGET_PERIOD (1 day) is longer than maxStaleness (15 min) — in real operation the
        // Enforcer would heartbeat throughout; simulate that with a fresh sync rather than let a
        // warp this long trip the (correct, and separately tested) fail-closed staleness check.
        vm.warp(block.timestamp + BUDGET_PERIOD);
        _syncAgent(_singleLeafRoot(recipient), 2, false);

        vm.startPrank(agent);
        _spendInChunks(BUDGET_TOTAL); // fully decayed — succeeds again
        vm.stopPrank();
    }

    function test_PayTo_LifetimeBudgetNeverDecaysWhenPeriodIsZero() public {
        // Re-sync with budgetPeriod = 0 ("lifetime budget", per mandate.md's own documented
        // meaning) — a fresh nonce, same agent.
        _syncAgent(_singleLeafRoot(recipient), 2, false, 0); // budgetPeriod 0 = lifetime, no decay

        vm.startPrank(agent);
        _spendInChunks(BUDGET_TOTAL);

        // Stay under maxStaleness so a specific-error assertion below actually isolates "lifetime
        // budgets never decay" from the separately-tested staleness fail-closed behavior.
        vm.warp(block.timestamp + MAX_STALENESS - 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentTreasury.AgentTreasury__BudgetExceeded.selector, BUDGET_TOTAL + 1, BUDGET_TOTAL
            )
        );
        treasury.payTo(recipient, 1, _emptyProof());
        vm.stopPrank();
    }

    function test_PayTo_RevertsOverUtilisationCap() public {
        // Pool is 1000 USDC at an 80% cap = 800 USDC drawable. Budget alone (500) doesn't hit
        // this, so raise the mandate's budget via a fresh sync to isolate the utilisation check.
        MandateAnchor.SyncPayload memory p = MandateAnchor.SyncPayload({
            agent: agent,
            node: keccak256("research.acme.eth"),
            termsHash: keccak256("terms"),
            expiry: uint64(block.timestamp + 30 days),
            budgetTotal: 900_000_000,
            budgetPeriod: BUDGET_PERIOD,
            perTxCap: 900_000_000,
            allowlistRoot: _singleLeafRoot(recipient),
            nonce: 3,
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

        vm.prank(agent);
        vm.expectRevert();
        treasury.payTo(recipient, 900_000_000, _emptyProof()); // over the 800 USDC utilisation cap
    }

    /*//////////////////////////////////////////////////////////////
                              DRAW / REPAY TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Draw_RevertsAboveMaxGasFloat() public {
        vm.prank(agent);
        vm.expectRevert();
        treasury.draw(5_000_001);
    }

    function test_Draw_TransfersToAgentWalletAndTracksPrincipal() public {
        vm.prank(agent);
        treasury.draw(5_000_000);

        assertEq(usdc.balanceOf(agent), 5_000_000);
        (, uint128 principal,,) = treasury.accounts(agent);
        assertEq(principal, 5_000_000);
    }

    function test_Draw_NeverConsumesTheSpendBudget() public {
        // Gas floats must never become an unaccountable spend path — see AgentTreasury's NatSpec.
        vm.prank(agent);
        treasury.draw(5_000_000);
        assertEq(treasury.spentNow(agent), 0, "draw must not touch the leaky-bucket budget");
    }

    function test_Repay_ReducesPrincipal() public {
        vm.startPrank(agent);
        treasury.draw(5_000_000);
        usdc.approve(address(treasury), type(uint256).max);
        treasury.repay(5_000_000);
        vm.stopPrank();

        (, uint128 principal,,) = treasury.accounts(agent);
        assertEq(principal, 0);
    }

    function test_Repay_CapsAtOutstandingPrincipal() public {
        usdc.mint(agent, 100_000_000);
        vm.startPrank(agent);
        treasury.draw(5_000_000);
        usdc.approve(address(treasury), type(uint256).max);
        treasury.repay(100_000_000); // way more than owed
        vm.stopPrank();

        (, uint128 principal,,) = treasury.accounts(agent);
        assertEq(principal, 0);
        assertEq(usdc.balanceOf(agent), 100_000_000, "must only pull what was actually owed");
    }

    /*//////////////////////////////////////////////////////////////
                              INTEREST TESTS
    //////////////////////////////////////////////////////////////*/

    function test_Accrue_GrowsWithPrincipalAndTime() public {
        vm.prank(agent);
        treasury.draw(5_000_000);

        vm.warp(block.timestamp + 365 days);
        // 10% APY on 5 USDC for a year = 0.5 USDC = 500_000 units.
        assertApproxEqAbs(treasury.accrue(agent), 500_000, 10);
    }

    function test_Accrue_IsZeroWithNoPrincipal() public view {
        assertEq(treasury.accrue(agent), 0);
    }

    /*//////////////////////////////////////////////////////////////
                              FUNDJOB TESTS
    //////////////////////////////////////////////////////////////*/

    function test_FundJob_ApprovesAndFundsThroughJobsContract() public {
        _syncAgent(_singleLeafRoot(address(jobs)), 4, false);

        vm.prank(agent);
        treasury.fundJob(1, 10_000_000, _emptyProof());

        assertEq(jobs.funded(1), 10_000_000);
        assertEq(usdc.balanceOf(address(jobs)), 10_000_000);
    }

    /*//////////////////////////////////////////////////////////////
                              SOLVENCY (INV-9)
    //////////////////////////////////////////////////////////////*/

    /// INV-9: liquid + deployed >= sum(outstanding commitments) — restated here as: the pool's own
    /// USDC balance plus everything it has drawn out must always equal what was deposited.
    function test_Solvency_LiquidPlusDrawnEqualsDeposited() public {
        vm.startPrank(agent);
        treasury.payTo(recipient, 10_000_000, _emptyProof());
        treasury.draw(5_000_000);
        vm.stopPrank();

        assertEq(
            usdc.balanceOf(address(treasury)) + treasury.totalDrawn(),
            treasury.totalDeposited(),
            "liquid + drawn must equal deposited"
        );
    }
}
