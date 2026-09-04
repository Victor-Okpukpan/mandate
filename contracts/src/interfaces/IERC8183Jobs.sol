// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title IERC8183Jobs
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Thin interface onto Arc's ERC-8183 job-escrow reference deployment (contract
///         `AgenticCommerce`), verified against the deployed implementation behind its ERC-1967
///         proxy at 0x0747EEf0706327138c69792bF28Cd525089e4583 (impl
///         0xa316fd02827242d537f84730f8a37d0ba5fd351a): `fund(uint256,bytes)` is `0xe25ba707`,
///         present in the deployed code. Only the function `AgentTreasury` actually calls —
///         everything else (job creation, submission, evaluation) is the agent runtime's own
///         direct integration with this same contract, out of `AgentTreasury`'s scope.
/// @dev ⚠️ `fund`'s exact authorization model (who may call it for a given job) was not verified
///      against the real deployment before this was written — SPONSOR-NOTES confirms the
///      signature matches the real ABI, not who is permitted to call it. Confirm this empirically
///      once credentials are available, alongside whoever calls `setBudget` — see the repo's
///      README "known limitations".
interface IERC8183Jobs {
    /// @notice Pull the job's already-set budget from `msg.sender` into escrow.
    ///         Requires prior `USDC.approve(address(this), amount)` by the caller.
    function fund(uint256 jobId, bytes calldata optParams) external;
}
