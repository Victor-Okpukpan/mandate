// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";

import { AgentTreasury } from "contracts/AgentTreasury.sol";

import { MockERC20 } from "contracts-test/mocks/MockERC20.sol";

/// @title TreasuryHandler
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Bounded entry points for `forge test --match-path 'test/invariant/*'`'s stateful
///         fuzzer to call against `AgentTreasury`. A fixed set of agents is pre-synced against a
///         real `MandateAnchor` in the invariant test's own `setUp()` — this handler only drives
///         deposit/draw/repay/payTo across that fixed set, never touching Sepolia or signing.
contract TreasuryHandler is Test {
    AgentTreasury public immutable TREASURY;
    MockERC20 public immutable USDC;
    address public immutable DEPOSITOR;
    address public immutable RECIPIENT;
    address[] internal _agents;

    uint256 public ghostDeposited;
    uint256 public ghostPaidToRecipient;

    constructor(
        AgentTreasury treasury,
        MockERC20 usdc,
        address depositor,
        address recipient,
        address[] memory agents
    ) {
        TREASURY = treasury;
        USDC = usdc;
        DEPOSITOR = depositor;
        RECIPIENT = recipient;
        _agents = agents;
    }

    function agentAt(uint256 index) public view returns (address) {
        return _agents[index % _agents.length];
    }

    function deposit(uint256 amount) external {
        amount = bound(amount, 0, 500_000e6);
        if (amount == 0) return;

        USDC.mint(DEPOSITOR, amount);
        vm.startPrank(DEPOSITOR);
        USDC.approve(address(TREASURY), amount);
        TREASURY.deposit(amount);
        vm.stopPrank();

        ghostDeposited += amount;
    }

    function draw(uint256 agentIndex, uint256 amount) external {
        address agent = agentAt(agentIndex);
        amount = bound(amount, 0, uint256(TREASURY.maxGasFloat()) * 2); // deliberately overshoots sometimes

        vm.prank(agent);
        try TREASURY.draw(amount) { } catch { }
    }

    function repay(uint256 agentIndex, uint256 amount) external {
        address agent = agentAt(agentIndex);
        amount = bound(amount, 0, 100_000e6);
        if (amount == 0) return;

        USDC.mint(agent, amount);
        vm.startPrank(agent);
        USDC.approve(address(TREASURY), amount);
        try TREASURY.repay(amount) { } catch { }
        vm.stopPrank();
    }

    function payTo(uint256 agentIndex, uint256 amount) external {
        address agent = agentAt(agentIndex);
        amount = bound(amount, 0, 200_000e6); // deliberately spans well past any single mandate's cap

        bytes32[] memory emptyProof = new bytes32[](0); // RECIPIENT is a single-leaf allowlist: root == leaf, empty proof

        vm.prank(agent);
        try TREASURY.payTo(RECIPIENT, amount, emptyProof) {
            ghostPaidToRecipient += amount;
        } catch { }
    }
}
