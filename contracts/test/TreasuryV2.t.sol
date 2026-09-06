// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";

import { AgentTreasury } from "contracts/AgentTreasury.sol";
import { MandateAnchor } from "contracts/MandateAnchor.sol";

import { MockERC20 } from "contracts-test/mocks/MockERC20.sol";
import { MockJobs } from "contracts-test/mocks/MockJobs.sol";

/// @title TreasuryV2Test
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Covers `AgentTreasury` v2's two additions: `withdraw` (the org's own liquidity was
///         previously unrecoverable) and `reconcileRefund` (an ERC-8183 escrow refund landing
///         back in the pool, reconciled against a balance delta rather than a call to
///         `claimRefund`'s unverified signature). See the contract-level NatSpec.
contract TreasuryV2Test is Test {
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
    address internal reconciler = makeAddr("reconciler");

    uint128 internal constant BUDGET_TOTAL = 500_000_000;
    uint128 internal constant PER_TX_CAP = 50_000_000;
    uint32 internal constant BUDGET_PERIOD = 86_400;
    uint64 internal constant MAX_STALENESS = 15 minutes;

    bytes32 internal constant SYNC_PAYLOAD_TYPEHASH = keccak256(
        "SyncPayload(address agent,bytes32 node,bytes32 termsHash,uint64 expiry,uint128 budgetTotal,uint32 budgetPeriod,uint128 perTxCap,bytes32 allowlistRoot,uint64 nonce,bool revoked)"
    );

    function setUp() public {
        enforcer = vm.addr(enforcerKey);
        usdc = new MockERC20();
        anchor = new MandateAnchor(enforcer, owner, MAX_STALENESS);
        jobs = new MockJobs(usdc);

        treasury = new AgentTreasury(usdc, anchor, jobs, owner, 5_000_000, 8_000, 0);

        _syncAgent(_singleLeafRoot(recipient), 1, false);

        usdc.mint(depositor, 1_000_000_000);
        vm.startPrank(depositor);
        usdc.approve(address(treasury), type(uint256).max);
        treasury.deposit(1_000_000_000); // 1000 USDC
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                                WITHDRAW
    //////////////////////////////////////////////////////////////*/

    function test_Withdraw_MovesLiquidityToRecipient() public {
        vm.prank(owner);
        treasury.withdraw(owner, 100_000_000);

        assertEq(usdc.balanceOf(owner), 100_000_000);
        assertEq(treasury.totalWithdrawn(), 100_000_000);
        assertEq(usdc.balanceOf(address(treasury)), 900_000_000);
    }

    function test_Withdraw_RevertsForNonOwner() public {
        vm.expectRevert();
        treasury.withdraw(depositor, 1);
    }

    function test_Withdraw_RevertsBeyondLiquidBalance() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentTreasury.AgentTreasury__InsufficientLiquidity.selector, 2_000_000_000, 1_000_000_000
            )
        );
        treasury.withdraw(owner, 2_000_000_000);
    }

    /// @dev The bug this whole feature exists to fix: after withdrawing, the utilisation cap must
    ///      shrink with the liquidity that actually left, not stay pinned to `totalDeposited`
    ///      alone — otherwise an agent can draw against a phantom ceiling.
    function test_Withdraw_ShrinksUtilisationCapBase() public {
        vm.prank(owner);
        treasury.withdraw(owner, 950_000_000); // leaves 50 USDC liquid, cap base now 50 USDC * 80%

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentTreasury.AgentTreasury__UtilisationCapExceeded.selector, 50_000_000, 40_000_000
            )
        );
        treasury.payTo(recipient, 50_000_000, _emptyProof());
    }

    /*//////////////////////////////////////////////////////////////
                            RECONCILE REFUND
    //////////////////////////////////////////////////////////////*/

    function test_ReconcileRefund_CreditsPrincipalFromRealSurplus() public {
        vm.prank(agent);
        treasury.payTo(recipient, 40_000_000, _emptyProof());
        (, uint128 principalBefore,,) = treasury.accounts(agent);
        assertEq(principalBefore, 40_000_000);

        // Simulate a returned ERC-8183 escrow landing back in the pool — a plain transfer, since
        // the real `claimRefund`'s signature is unconfirmed; this is exactly why the design
        // reconciles a balance delta instead of calling it directly.
        usdc.mint(address(treasury), 40_000_000);

        vm.prank(owner);
        treasury.reconcileRefund(agent, 7, 40_000_000);

        (uint128 spentAccum, uint128 principalAfter,,) = treasury.accounts(agent);
        assertEq(principalAfter, 0, "principal should be fully credited");
        assertEq(spentAccum, 0, "spentAccum should be credited back");
        assertEq(treasury.totalDrawn(), 0);
    }

    function test_ReconcileRefund_BooksSurplusAsDeposit() public {
        vm.prank(agent);
        treasury.payTo(recipient, 40_000_000, _emptyProof());

        uint256 depositedBefore = treasury.totalDeposited();
        usdc.mint(address(treasury), 60_000_000); // more than the outstanding principal

        vm.prank(owner);
        treasury.reconcileRefund(agent, 7, 60_000_000);

        (, uint128 principalAfter,,) = treasury.accounts(agent);
        assertEq(principalAfter, 0);
        assertEq(treasury.totalDeposited(), depositedBefore + 20_000_000, "surplus becomes org liquidity");
    }

    /// @dev The load-bearing security property: even the designated reconciler cannot forgive
    ///      principal that no USDC actually came back for.
    function test_ReconcileRefund_RevertsBeyondUnaccountedSurplus() public {
        vm.prank(agent);
        treasury.payTo(recipient, 40_000_000, _emptyProof());

        vm.prank(owner);
        treasury.setRefundReconciler(reconciler);

        vm.prank(reconciler);
        vm.expectRevert(
            abi.encodeWithSelector(AgentTreasury.AgentTreasury__RefundExceedsSurplus.selector, 1, 0)
        );
        treasury.reconcileRefund(agent, 7, 1);
    }

    function test_ReconcileRefund_RevertsForUnauthorizedCaller() public {
        vm.prank(agent);
        treasury.payTo(recipient, 40_000_000, _emptyProof());
        usdc.mint(address(treasury), 40_000_000);

        vm.expectRevert(
            abi.encodeWithSelector(AgentTreasury.AgentTreasury__NotReconciler.selector, address(this))
        );
        treasury.reconcileRefund(agent, 7, 40_000_000);
    }

    function test_ReconcileRefund_DesignatedReconcilerCanCall() public {
        vm.prank(owner);
        treasury.setRefundReconciler(reconciler);

        vm.prank(agent);
        treasury.payTo(recipient, 40_000_000, _emptyProof());
        usdc.mint(address(treasury), 40_000_000);

        vm.prank(reconciler);
        treasury.reconcileRefund(agent, 7, 40_000_000);

        (, uint128 principalAfter,,) = treasury.accounts(agent);
        assertEq(principalAfter, 0);
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    function _singleLeafRoot(address only) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(only));
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
        MandateAnchor.SyncPayload memory p = MandateAnchor.SyncPayload({
            agent: agent,
            node: keccak256("research.acme.eth"),
            termsHash: keccak256("terms"),
            expiry: uint64(block.timestamp + 30 days),
            budgetTotal: BUDGET_TOTAL,
            budgetPeriod: BUDGET_PERIOD,
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
}
