// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title IERC8183Jobs
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Interface onto Arc's ERC-8183 job-escrow reference deployment (contract
///         `AgenticCommerce`), pulled from the VERIFIED source at
///         https://testnet.arcscan.app behind the ERC-1967 proxy at
///         0x0747EEf0706327138c69792bF28Cd525089e4583 (impl
///         0xa316fd02827242d537f84730f8a37d0ba5fd351a). Every function and its authorization
///         model below is read from that real source, not inferred from the selector alone.
/// @dev Confirmed live authorization models (this is what `AgentTreasury` is built against):
///      - `createJob` sets `job.client = msg.sender` — this is why `AgentTreasury.createJob`
///        exists as a wrapper: `fund` later requires `msg.sender == job.client`, so the job MUST
///        be created by this contract, not by the agent's own wallet, or `fundJob` would revert
///        `Unauthorized()` every time (`msg.sender` inside `JOBS.fund` is this contract, not the
///        agent). This was found, not spec'd — see AgentTreasury.sol's NatSpec.
///      - `fund` requires `msg.sender == job.client`, `job.provider != address(0)`, and
///        `job.status == Open`.
///      - `setBudget` requires `msg.sender == job.provider` — the counterparty, never this
///        contract or its agents. Out of `AgentTreasury`'s scope entirely.
///      - `claimRefund` is genuinely permissionless (no caller check in the real source) —
///        callable by anyone once `block.timestamp >= job.expiredAt` and status is Funded or
///        Submitted. Refunds `job.budget` to `job.client`. Safe to wire in directly.
interface IERC8183Jobs {
    enum JobStatus {
        Open,
        Funded,
        Submitted,
        Completed,
        Rejected,
        Expired
    }

    struct Job {
        uint256 id;
        address client;
        address provider;
        address evaluator;
        string description;
        uint256 budget;
        uint256 expiredAt;
        JobStatus status;
        address hook;
    }

    /// @notice Creates a job with `msg.sender` as `job.client`. `AgentTreasury.createJob` calls
    ///         this as ITSELF so every job it later `fund`s satisfies `fund`'s own-client check.
    function createJob(
        address provider,
        address evaluator,
        uint256 expiredAt,
        string calldata description,
        address hook
    ) external returns (uint256 jobId);

    /// @notice Pull the job's already-set budget from `msg.sender` (must be `job.client`) into
    ///         escrow. Requires prior `USDC.approve(address(this), amount)` by the caller.
    function fund(uint256 jobId, bytes calldata optParams) external;

    /// @notice Refund `job.budget` to `job.client` once the job has expired unresolved.
    ///         Permissionless — confirmed in the real source, no caller check at all.
    function claimRefund(uint256 jobId) external;

    function getJob(uint256 jobId) external view returns (Job memory);
}
