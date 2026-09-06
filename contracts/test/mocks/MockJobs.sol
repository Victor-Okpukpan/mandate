// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { IERC20 } from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import { IERC8183Jobs } from "contracts/interfaces/IERC8183Jobs.sol";

/// @title MockJobs
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Stand-in for the real ERC-8183 `AgenticCommerce` deployment, modelling exactly the
///         authorization checks `AgentTreasury` is built against (verified live against the real
///         source on Arcscan — see `IERC8183Jobs`'s NatSpec): `createJob` sets `client =
///         msg.sender`, `fund` requires `msg.sender == client` and an Open job with a provider
///         set, `claimRefund` is genuinely permissionless and requires an expired Funded/Submitted
///         job. Anything the real contract enforces that `AgentTreasury` never exercises (hooks,
///         evaluator fees, `setBudget`'s provider-only gate) is left out rather than faked.
contract MockJobs is IERC8183Jobs {
    IERC20 public immutable USDC;
    uint256 public jobCounter;
    mapping(uint256 => Job) internal _jobs;

    error MockJobs__Unauthorized();
    error MockJobs__WrongStatus();
    error MockJobs__ProviderNotSet();
    error MockJobs__NotExpired();

    constructor(IERC20 usdc) {
        USDC = usdc;
    }

    function createJob(
        address provider,
        address evaluator,
        uint256 expiredAt,
        string calldata description,
        address hook
    ) external returns (uint256 jobId) {
        jobId = ++jobCounter;
        _jobs[jobId] = Job({
            id: jobId,
            client: msg.sender,
            provider: provider,
            evaluator: evaluator,
            description: description,
            budget: 0,
            expiredAt: expiredAt,
            status: JobStatus.Open,
            hook: hook
        });
    }

    /// @dev The real contract pulls `job.budget` via `safeTransferFrom` after checking
    ///      `msg.sender == client`. `AgentTreasury.fundJob` always calls with `budget == amount`
    ///      it just `forceApprove`d, so this mock reads the allowance directly the same way the
    ///      original placeholder did, while still enforcing the real ownership check.
    function fund(uint256 jobId, bytes calldata) external {
        Job storage job = _jobs[jobId];
        if (job.id == 0) revert MockJobs__WrongStatus();
        if (job.status != JobStatus.Open) revert MockJobs__WrongStatus();
        if (msg.sender != job.client) revert MockJobs__Unauthorized();
        if (job.provider == address(0)) revert MockJobs__ProviderNotSet();

        uint256 allowance = USDC.allowance(msg.sender, address(this));
        job.budget = allowance;
        job.status = JobStatus.Funded;
        if (allowance > 0) USDC.transferFrom(msg.sender, address(this), allowance);
    }

    /// @notice Permissionless, matching the real contract exactly. Pays `job.client` — always
    ///         `AgentTreasury` for a job it created — so tests can assert the resulting balance
    ///         delta the same way `reclaimJobRefund` does against the real deployment.
    function claimRefund(uint256 jobId) external {
        Job storage job = _jobs[jobId];
        if (job.id == 0) revert MockJobs__WrongStatus();
        if (job.status != JobStatus.Funded && job.status != JobStatus.Submitted) {
            revert MockJobs__WrongStatus();
        }
        if (block.timestamp < job.expiredAt) revert MockJobs__NotExpired();

        job.status = JobStatus.Expired;
        if (job.budget > 0) USDC.transfer(job.client, job.budget);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return _jobs[jobId];
    }

    /// @dev Test-only helper — the real contract's `setProvider` requires `msg.sender ==
    ///      job.client`, which `AgentTreasury.createJob`'s caller already satisfies since it IS
    ///      the client; exposed directly here so fork/unit tests can set up a fundable job without
    ///      re-modelling that whole function.
    function setProviderForTest(uint256 jobId, address provider) external {
        _jobs[jobId].provider = provider;
    }
}
