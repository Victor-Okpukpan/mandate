// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { IERC20 } from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import { IERC8183Jobs } from "contracts/interfaces/IERC8183Jobs.sol";

/// @title MockJobs
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Stand-in for the real ERC-8183 Jobs contract's `fund` entry point — pulls `amount` from
///         the caller via a prior approval, records it against `jobId`. Job creation/lifecycle is
///         out of `AgentTreasury`'s scope (see `IERC8183Jobs`'s NatSpec), so this mock only needs
///         to prove `fundJob` approved and called correctly.
contract MockJobs is IERC8183Jobs {
    IERC20 public immutable USDC;
    mapping(uint256 jobId => uint256) public funded;

    constructor(IERC20 usdc) {
        USDC = usdc;
    }

    function fund(uint256 jobId, bytes calldata) external {
        uint256 allowance = USDC.allowance(msg.sender, address(this));
        USDC.transferFrom(msg.sender, address(this), allowance);
        funded[jobId] += allowance;
    }
}
