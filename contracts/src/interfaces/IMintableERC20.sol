// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import { IERC20 } from "openzeppelin-contracts/token/ERC20/IERC20.sol";

/// @title IMintableERC20
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Test-only interface onto Sepolia's `MockUSDC` — confirmed permissionless: simulating
///         `mint(address,uint256)` from an unprivileged EOA succeeds on the deployed contract.
interface IMintableERC20 is IERC20 {
    function mint(address to, uint256 amount) external;
}
