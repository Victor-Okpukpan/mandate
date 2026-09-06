// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import { AgentTreasury } from "contracts/AgentTreasury.sol";
import { MandateAnchor } from "contracts/MandateAnchor.sol";
import { IERC8183Jobs } from "contracts/interfaces/IERC8183Jobs.sol";

/// @title AgentTreasuryJobsForkTest
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Proves `AgentTreasury.createJob` against the REAL deployed `AgenticCommerce` contract
///         on Arc testnet — not `MockJobs` — for the specific bug this file exists to catch:
///         before `createJob` existed, `AgentTreasury.fundJob` would call the real `JOBS.fund` as
///         ITSELF, but `fund` requires `msg.sender == job.client`, and every job was created by
///         the agent's own wallet — so `job.client` was the agent, never the treasury, and every
///         real `fundJob` call would have reverted `Unauthorized()`, unconditionally, forever.
///
/// @dev `fund`'s and `claimRefund`'s money-moving paths (`safeTransferFrom`/`safeTransfer` of
///      real USDC) are deliberately NOT exercised here. Arc testnet's real USDC (`FiatTokenProxy`
///      at `ARC_USDC`) needs genuine balance to test against, and every path to get some failed on
///      a real, external blocker, not a guess:
///        - `deal`'s automatic storage-slot finder can't locate `balances` in this proxy's layout
///          (a raw slot scan of 0–30 doesn't find `totalSupply` either, so this is Circle's own
///          non-trivial layout, not something worth reverse-engineering for a test fixture).
///        - The real `mint`, called through an impersonated `masterMinter` exactly as Arc's own
///          minter-role model requires, reverts inside a call to `0x1800…0001` — an Arc-native
///          compliance precompile with a `StackUnderflow` under Foundry's fork EVM, which doesn't
///          emulate it. This is a forking-tool limitation, not a contract bug.
///      `fund`'s and `claimRefund`'s authorization models (the actual subject of the bug this file
///      fixes) are still fully covered — with real USDC, via the faithful `MockJobs` mock — by
///      `test/TreasurySpend.t.sol`'s `test_FundJob_RevertsIfCallerDidNotCreateTheJob` and
///      `test_ReclaimJobRefund_CreditsAgentPrincipalFromExpiredJob`. What only a real fork can
///      prove — that the real deployed contract actually records `job.client == address(treasury)`
///      when `createJob` calls it — is what this test proves.
contract AgentTreasuryJobsForkTest is Test {
    AgentTreasury internal treasury;
    MandateAnchor internal anchor;
    IERC20 internal usdc;
    IERC8183Jobs internal jobs;

    address internal owner = makeAddr("owner");
    address internal enforcer = makeAddr("enforcer");
    address internal provider = makeAddr("provider");
    address internal evaluator = makeAddr("evaluator");

    function setUp() public {
        string memory rpcUrl = vm.envOr("ARC_RPC_URL", string("https://rpc.testnet.arc.network"));
        vm.createSelectFork(rpcUrl);

        address usdcAddr = vm.envOr("ARC_USDC", address(0x3600000000000000000000000000000000000000));
        address jobsAddr =
            vm.envOr("ARC_ERC8183_JOBS", address(0x0747EEf0706327138c69792bF28Cd525089e4583));
        usdc = IERC20(usdcAddr);
        jobs = IERC8183Jobs(jobsAddr);

        anchor = new MandateAnchor(enforcer, owner, 15 minutes);
        treasury = new AgentTreasury(usdc, anchor, jobs, owner, 5e6, 8_000, 1_000);
    }

    function test_CreateJob_SetsTreasuryAsClientOnTheRealDeployedContract() public {
        uint256 jobId =
            treasury.createJob(provider, evaluator, block.timestamp + 1 days, "fork test job", address(0));

        IERC8183Jobs.Job memory job = jobs.getJob(jobId);
        assertEq(job.client, address(treasury), "real AgenticCommerce did not record treasury as client");
        assertEq(uint8(job.status), uint8(IERC8183Jobs.JobStatus.Open));
        assertEq(treasury.jobAgent(jobId), address(this));
    }

    /// @notice `createJob`'s `provider` argument is set directly on the real `Job` struct at
    ///         creation (confirmed from source: `provider: provider` in `AgenticCommerce.createJob`)
    ///         — there is no separate provider-assignment step needed for the common case where
    ///         the client already knows who they're hiring.
    function test_CreateJob_SetsProviderDirectlyOnTheRealContract() public {
        uint256 jobId =
            treasury.createJob(provider, evaluator, block.timestamp + 1 days, "fork test job", address(0));

        assertEq(jobs.getJob(jobId).provider, provider);
    }
}
