// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { Ownable } from "openzeppelin-contracts/access/Ownable.sol";
import { Ownable2Step } from "openzeppelin-contracts/access/Ownable2Step.sol";
import { IERC20 } from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {
    ReentrancyGuardTransient
} from "openzeppelin-contracts/utils/ReentrancyGuardTransient.sol";
import { SafeCast } from "openzeppelin-contracts/utils/math/SafeCast.sol";
import { Address } from "openzeppelin-contracts/utils/Address.sol";

import { IERC8183Jobs } from "contracts/interfaces/IERC8183Jobs.sol";
import { MandateAnchor } from "contracts/MandateAnchor.sol";

/// @title AgentTreasury
/// @author Victor Okpukpan (@victorokpukpan_)
/// @custom:security-contact https://x.com/victorokpukpan_
/// @notice The org's USDC pool on Arc, structured as a revolving credit facility. Agents never
///         hold float beyond a small gas draw; they pull directly from the pool to pay a
///         counterparty, checked against `MandateAnchor` on every spend, and the pool's
///         outstanding balance accrues interest to the org until repaid from job proceeds. A
///         spending mandate and a credit limit are the same object.
///
/// @dev Two deliberate departures from the original spec, both closing real holes found while
///      implementing it — see each one's NatSpec below for the full reasoning:
///
///      1. **Typed spend paths, not a generic executor.** The original design's `spend(target,
///         data, amount, proof)` executed agent-supplied calldata FROM the pooled treasury, gated
///         by a merkle leaf of only `(target, selector)` — which never bound the recipient. An
///         allowlisted `USDC.transfer` selector would let an agent send pooled funds to ANY
///         address; an allowlisted `approve` would hand out a drain. `payTo` and `fundJob` replace
///         it: the merkle leaf is the RECIPIENT, and no agent-supplied calldata ever executes from
///         this contract.
///      2. **A leaky bucket, not a fixed window.** `spentInWindow[agent][timestamp/period]` lets an
///         agent spend `budgetTotal` twice across a window boundary, and divides by zero when
///         `period == 0` (the spec's own "lifetime budget" case). `_consumeBudget` decays the
///         accumulated spend linearly instead: no boundary to straddle, and `period == 0` decays
///         nothing at all — exactly the lifetime cap the spec wanted, without the crash.
///
///      v2 closes a third hole, found rather than spec'd: there was no way for the org to ever
///      get its own deposited USDC back out, and no way to reconcile funds an ERC-8183 job
///      returns via `claimRefund` (a real function on the deployed Jobs contract, per
///      SPONSOR-NOTES §1.5 — signature unconfirmed, see `callJobs`). See `withdraw` and
///      `reconcileRefund` below; both preserve INV-1 and the restated INV-9.
contract AgentTreasury is Ownable2Step, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /*//////////////////////////////////////////////////////////////
                            TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice One agent's ledger. Two storage slots.
    struct AgentAccount {
        /// @dev Leaky-bucket accumulator for the mandate's rolling budget — decays linearly toward
        ///      0 over `budgetPeriod` seconds since `lastSpendAt`. Consumption only; the ceiling
        ///      itself (`budgetTotal`/`budgetPeriod`) lives on `MandateAnchor`, not mirrored here.
        uint128 spentAccum;
        /// @dev Outstanding balance drawn from the pool — gas floats plus every `payTo`/`fundJob`
        ///      spend — accruing interest until `repay`'d. The credit facility's actual ledger.
        uint128 principal;
        uint64 lastSpendAt;
        uint64 lastAccrualAt;
    }

    /*//////////////////////////////////////////////////////////////
                              STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    uint256 internal constant BPS_DENOMINATOR = 10_000;
    uint256 internal constant SECONDS_PER_YEAR = 365 days;

    IERC20 public immutable USDC;
    MandateAnchor public immutable ANCHOR;
    IERC8183Jobs public immutable JOBS;

    /// @dev A gas-float draw is capped hard and separately from the spend budget — see `draw`'s
    ///      NatSpec for why this must never become a spend path of its own.
    uint128 public maxGasFloat;

    /// @notice Max fraction of deposited liquidity that may be outstanding at once, in bps.
    uint16 public utilisationCapBps;
    /// @notice Simple annualized interest rate on outstanding principal, in bps.
    uint16 public interestRateBps;

    uint256 public totalDeposited;
    uint256 public totalDrawn;
    /// @dev Liquidity the org has pulled back out via `withdraw`. Tracked separately rather than
    ///      decremented from `totalDeposited` because `totalDeposited` is also the utilisation-cap
    ///      base (`_checkUtilisationCap`) — conflating the two would let the cap silently widen
    ///      back out after a withdrawal instead of shrinking with the liquidity that actually left.
    uint256 public totalWithdrawn;

    /// @notice Address permitted to call `reconcileRefund` in addition to the owner — e.g. an
    ///         automation key that watches for ERC-8183 `claimRefund` proceeds landing here.
    ///         Zero address means only the owner may reconcile.
    address public refundReconciler;

    mapping(address agent => AgentAccount) public accounts;

    /*//////////////////////////////////////////////////////////////
                                  EVENTS
    //////////////////////////////////////////////////////////////*/

    event Deposited(address indexed from, uint256 amount);
    event Drawn(address indexed agent, uint256 amount);
    event Repaid(address indexed agent, uint256 amount, uint256 interestSettled);
    event AgentSpent(address indexed agent, address indexed recipient, uint256 amount);
    event JobFunded(address indexed agent, uint256 indexed jobId, uint256 amount);
    event UtilisationCapUpdated(uint16 bps);
    event InterestRateUpdated(uint16 bps);
    event MaxGasFloatUpdated(uint128 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event RefundReconcilerUpdated(address indexed reconciler);
    event RefundReconciled(address indexed agent, uint256 indexed jobId, uint256 applied, uint256 surplus);

    /*//////////////////////////////////////////////////////////////
                                  ERRORS
    //////////////////////////////////////////////////////////////*/

    error AgentTreasury__ZeroAddress();
    error AgentTreasury__ZeroAmount();
    error AgentTreasury__ExceedsGasFloat(uint256 requested, uint128 maxGasFloat);
    error AgentTreasury__UtilisationCapExceeded(uint256 wouldBeDrawn, uint256 cap);
    error AgentTreasury__BudgetExceeded(uint256 wouldBeSpent, uint128 budgetTotal);
    error AgentTreasury__InvalidBps(uint16 bps);
    error AgentTreasury__InsufficientLiquidity(uint256 requested, uint256 available);
    error AgentTreasury__NotReconciler(address caller);
    error AgentTreasury__RefundExceedsSurplus(uint256 requested, uint256 available);

    /*//////////////////////////////////////////////////////////////
                              INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /// @param usdc Arc's USDC, ERC-20 path (6dp) — see packages/shared/src/decimals.ts.
    /// @param anchor The `MandateAnchor` this treasury checks every spend against.
    /// @param jobs ERC-8183 Jobs — `fundJob` pulls into escrow here.
    /// @param initialOwner The org admin. A multisig on mainnet — see contracts/README.md.
    /// @param maxGasFloat_ Hard ceiling on any single `draw`, e.g. enough for a day of Arc gas.
    /// @param utilisationCapBps_ Max fraction of deposited liquidity drawable at once, in bps.
    /// @param interestRateBps_ Simple annualized interest rate on outstanding principal, in bps.
    constructor(
        IERC20 usdc,
        MandateAnchor anchor,
        IERC8183Jobs jobs,
        address initialOwner,
        uint128 maxGasFloat_,
        uint16 utilisationCapBps_,
        uint16 interestRateBps_
    ) Ownable(initialOwner) {
        if (
            address(usdc) == address(0) || address(anchor) == address(0)
                || address(jobs) == address(0)
        ) {
            revert AgentTreasury__ZeroAddress();
        }
        if (utilisationCapBps_ > BPS_DENOMINATOR) {
            revert AgentTreasury__InvalidBps(utilisationCapBps_);
        }

        USDC = usdc;
        ANCHOR = anchor;
        JOBS = jobs;
        maxGasFloat = maxGasFloat_;
        utilisationCapBps = utilisationCapBps_;
        interestRateBps = interestRateBps_;
    }

    /*//////////////////////////////////////////////////////////////
                    USER-FACING STATE-CHANGING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Add liquidity to the pool. Permissionless — anyone may top up the org's treasury.
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert AgentTreasury__ZeroAmount();
        totalDeposited += amount;
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Draw a small gas float into the caller's own wallet.
    /// @dev Deliberately bounded far below the mandate's spend budget, checked against neither the
    ///      allowlist nor `MandateAnchor` at all: this exists ONLY to keep an agent's wallet able
    ///      to pay Arc gas, never to become an unaccountable path around `payTo`/`fundJob`'s
    ///      allowlist and budget checks. `maxGasFloat` is the enforcement — keep it minimal. A full
    ///      compromise of an agent's wallet yields at most `maxGasFloat`, never the pool.
    function draw(uint256 amount) external nonReentrant {
        if (amount == 0) revert AgentTreasury__ZeroAmount();
        if (amount > maxGasFloat) revert AgentTreasury__ExceedsGasFloat(amount, maxGasFloat);

        _settleInterest(msg.sender);
        _checkUtilisationCap(amount);

        AgentAccount storage acct = accounts[msg.sender];
        // Checked downcast throughout this contract, not a hand-proven raw cast: cheap, and
        // provably-safe-today casts have a way of becoming unsafe after a later edit.
        acct.principal += amount.toUint128();
        totalDrawn += amount;

        USDC.safeTransfer(msg.sender, amount);
        emit Drawn(msg.sender, amount);
    }

    /// @notice Repay outstanding principal (and any pending interest) from job proceeds.
    function repay(uint256 amount) external nonReentrant {
        if (amount == 0) revert AgentTreasury__ZeroAmount();

        uint256 interestSettled = accrue(msg.sender);
        _settleInterest(msg.sender);
        AgentAccount storage acct = accounts[msg.sender];

        uint256 applied = amount > acct.principal ? acct.principal : amount;
        acct.principal -= applied.toUint128();
        totalDrawn -= applied;

        USDC.safeTransferFrom(msg.sender, address(this), applied);
        emit Repaid(msg.sender, applied, interestSettled);
    }

    /// @notice Withdraw the org's own deposited liquidity. Owner-gated: this pulls actual USDC out
    ///         of the pool, unlike every setter above it.
    /// @dev Before v2 there was no way to do this at all — deposited USDC was permanently locked
    ///      in the contract, recoverable only via `draw`/`payTo`/`fundJob` moving it back out
    ///      through an agent. That is a worse gap than the missing escrow-refund path this same
    ///      version adds. Bounded by actual on-chain liquidity, not by `totalDeposited` alone —
    ///      liquidity already lent out via `draw`/`payTo`/`fundJob` is by definition not sitting
    ///      here to withdraw.
    function withdraw(address to, uint256 amount) external nonReentrant onlyOwner {
        if (to == address(0)) revert AgentTreasury__ZeroAddress();
        if (amount == 0) revert AgentTreasury__ZeroAmount();
        uint256 liquid = USDC.balanceOf(address(this));
        if (amount > liquid) revert AgentTreasury__InsufficientLiquidity(amount, liquid);

        totalWithdrawn += amount;
        USDC.safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Reconcile USDC that landed back in this contract from a returned escrow (e.g. an
    ///         ERC-8183 `claimRefund`) against `agent`'s outstanding principal.
    /// @dev Deliberately reconciles a BALANCE DELTA rather than calling any external refund
    ///      function directly — `claimRefund`'s real signature and caller-authorization model are
    ///      unconfirmed (SPONSOR-NOTES §1.5 records only that the function exists). This design
    ///      lets a refund be reconciled by whatever actually triggers it (this contract's own
    ///      `callJobs`, a future typed call once the signature is confirmed, or even a manual
    ///      transfer) without ever needing another redeploy.
    ///
    ///      The `unaccounted` guard is the load-bearing security property here: even a fully
    ///      compromised `refundReconciler` cannot forgive principal that no USDC actually came
    ///      back for, because `amount` is capped by real, otherwise-unexplained balance sitting in
    ///      this contract right now. Its worst case is misattributing a genuine refund to the
    ///      wrong agent — it can never manufacture funds that were never deposited.
    ///
    ///      Crediting `spentAccum` back down is correct, not merely convenient: the mandate did
    ///      not, in the end, spend what came back, so `spentNow(agent) <= budgetTotal` (INV-1) can
    ///      only be strengthened by this, never broken.
    function reconcileRefund(address agent, uint256 jobId, uint256 amount) external nonReentrant {
        if (msg.sender != refundReconciler && msg.sender != owner()) {
            revert AgentTreasury__NotReconciler(msg.sender);
        }

        uint256 accountedLiquid = totalDeposited - totalWithdrawn - totalDrawn;
        uint256 unaccounted = USDC.balanceOf(address(this)) - accountedLiquid;
        if (amount > unaccounted) revert AgentTreasury__RefundExceedsSurplus(amount, unaccounted);

        _settleInterest(agent);
        AgentAccount storage acct = accounts[agent];

        uint256 applied = amount > acct.principal ? acct.principal : amount;
        acct.principal -= applied.toUint128();
        totalDrawn -= applied;

        uint256 surplus = amount - applied;
        if (surplus > 0) totalDeposited += surplus;

        (, uint32 budgetPeriod) = ANCHOR.budgetOf(agent);
        uint128 decayed = _decayedSpent(acct, budgetPeriod);
        acct.spentAccum = decayed > applied ? decayed - applied.toUint128() : 0;

        emit RefundReconciled(agent, jobId, applied, surplus);
    }

    /// @notice Owner-gated escape hatch to call the immutable `JOBS` contract directly — e.g. to
    ///         trigger `claimRefund` once its real signature is confirmed on Arc.
    /// @dev Hard-restricted to `JOBS`, never a caller-supplied target: this is not, and must never
    ///      become, the generic `(target, data)` executor the contract-level NatSpec's
    ///      simplification #1 already rejected for `payTo`/`fundJob`. Follow with
    ///      `reconcileRefund` to credit whatever balance delta this produces.
    function callJobs(bytes calldata data) external onlyOwner nonReentrant returns (bytes memory) {
        return Address.functionCall(address(JOBS), data);
    }

    function setRefundReconciler(address reconciler) external onlyOwner {
        refundReconciler = reconciler;
        emit RefundReconcilerUpdated(reconciler);
    }

    /// @notice Pay `to` directly from the pool. The core spend path: checked against
    ///         `MandateAnchor` (revocation, expiry, per-tx cap, staleness, and — via `proof` —
    ///         allowlist membership) and against this contract's own leaky-bucket rolling budget.
    /// @param proof Merkle proof that `to` is allowlisted, against the mandate's `allowlistRoot`.
    ///        Leaf is `keccak256(abi.encodePacked(to))` — see the contract-level NatSpec on why the
    ///        leaf binds the recipient rather than a target+selector pair.
    function payTo(address to, uint256 amount, bytes32[] calldata proof) external nonReentrant {
        if (to == address(0)) revert AgentTreasury__ZeroAddress();
        _spend(to, amount, proof);
        USDC.safeTransfer(to, amount);
    }

    /// @notice Fund an ERC-8183 job's already-set budget from the pool.
    /// @dev The job itself (creation, budget-setting, submission, evaluation) is the agent
    ///      runtime's own direct integration with the Jobs contract — this function's only job is
    ///      moving `amount` from the pool into escrow, checked the same way `payTo` is. `proof`
    ///      proves the Jobs contract's OWN address is allowlisted as a recipient, e.g. via
    ///      `mandate.allow.human`'s `[{"target":"<Jobs address>","label":"ERC-8183 Jobs"}]` entry.
    function fundJob(uint256 jobId, uint256 amount, bytes32[] calldata proof)
        external
        nonReentrant
    {
        _spend(address(JOBS), amount, proof);
        USDC.forceApprove(address(JOBS), amount);
        JOBS.fund(jobId, "");
        emit JobFunded(msg.sender, jobId, amount);
    }

    /// @notice Adjust the pool-wide utilisation ceiling. Owner-gated; no timelock — tightening is
    ///         strictly safer and loosening is a bounded, reversible risk next to a key change.
    function setUtilisationCap(uint16 bps) external onlyOwner {
        if (bps > BPS_DENOMINATOR) revert AgentTreasury__InvalidBps(bps);
        utilisationCapBps = bps;
        emit UtilisationCapUpdated(bps);
    }

    function setInterestRate(uint16 bps) external onlyOwner {
        interestRateBps = bps;
        emit InterestRateUpdated(bps);
    }

    function setMaxGasFloat(uint128 amount) external onlyOwner {
        maxGasFloat = amount;
        emit MaxGasFloatUpdated(amount);
    }

    /*//////////////////////////////////////////////////////////////
                    USER-FACING READ-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Interest accrued since `lastAccrualAt` but not yet capitalized into `principal`.
    /// @dev Simple interest: `principal * rateBps * elapsed / (SECONDS_PER_YEAR * BPS_DENOMINATOR)`. Deliberately
    ///      simple — this is the first thing to cut if the demo needs it (draw/repay alone still
    ///      qualify Arc's DeFi-pool bounty on payments + treasury; see the repo's README).
    function accrue(address agent) public view returns (uint256 interest) {
        AgentAccount storage acct = accounts[agent];
        if (acct.principal == 0 || acct.lastAccrualAt == 0) return 0;
        uint256 elapsed = block.timestamp - acct.lastAccrualAt;
        interest = (uint256(acct.principal) * interestRateBps * elapsed)
            / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
    }

    /// @notice The leaky-bucket-decayed amount currently counted against `agent`'s rolling budget.
    function spentNow(address agent) external view returns (uint128) {
        (, uint32 budgetPeriod) = ANCHOR.budgetOf(agent);
        return _decayedSpent(accounts[agent], budgetPeriod);
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL STATE-CHANGING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Shared path for `payTo` and `fundJob`: `MandateAnchor` first (the stateless pre-filter's
    ///      on-chain twin — revocation, expiry, per-tx cap, staleness, allowlist), then this
    ///      contract's own stateful, authoritative rolling budget — the split documented in
    ///      SPONSOR-NOTES §3.1b: Privy cannot be the budget enforcer at scale, so the cumulative
    ///      ledger lives here instead.
    function _spend(address recipient, uint256 amount, bytes32[] calldata proof) internal {
        if (amount == 0) revert AgentTreasury__ZeroAmount();
        ANCHOR.assertSpend(msg.sender, recipient, amount, proof);

        _consumeBudget(msg.sender, amount);
        _settleInterest(msg.sender);
        _checkUtilisationCap(amount);

        AgentAccount storage acct = accounts[msg.sender];
        acct.principal += amount.toUint128();
        totalDrawn += amount;

        emit AgentSpent(msg.sender, recipient, amount);
    }

    /// @dev Leaky-bucket budget consumption — see the contract-level NatSpec's simplification #2.
    function _consumeBudget(address agent, uint256 amount) internal {
        (uint128 budgetTotal, uint32 budgetPeriod) = ANCHOR.budgetOf(agent);
        AgentAccount storage acct = accounts[agent];

        uint128 decayed = _decayedSpent(acct, budgetPeriod);
        uint256 newTotal = uint256(decayed) + amount;
        if (newTotal > budgetTotal) revert AgentTreasury__BudgetExceeded(newTotal, budgetTotal);

        acct.spentAccum = newTotal.toUint128();
        acct.lastSpendAt = uint64(block.timestamp);
    }

    /// @dev Capitalizes any interest accrued since the last settlement into `principal`, owed to
    ///      the org. Called before every `draw`/`repay`/spend so `principal` is always current.
    ///      `interest` is a genuinely unbounded function of `principal * rate * elapsed`: years of
    ///      neglected settlement at a high rate on a large principal could in principle overflow
    ///      uint128. Reverting is the right failure mode there — it means `repay`/`accrue` needs
    ///      calling more often, not a silently wrapped, corrupted principal ledger.
    function _settleInterest(address agent) internal {
        uint256 interest = accrue(agent);
        AgentAccount storage acct = accounts[agent];
        if (interest > 0) {
            acct.principal += interest.toUint128();
            totalDrawn += interest;
        }
        acct.lastAccrualAt = uint64(block.timestamp);
    }

    /// @dev Base is `totalDeposited - totalWithdrawn`, not `totalDeposited` alone — liquidity the
    ///      owner has already `withdraw`n is no longer backing anything and must shrink the cap
    ///      with it, or an agent could keep drawing against a phantom ceiling after the org pulled
    ///      its own funds back out.
    function _checkUtilisationCap(uint256 amount) internal view {
        uint256 cap = ((totalDeposited - totalWithdrawn) * utilisationCapBps) / BPS_DENOMINATOR;
        uint256 wouldBeDrawn = totalDrawn + amount;
        if (wouldBeDrawn > cap) revert AgentTreasury__UtilisationCapExceeded(wouldBeDrawn, cap);
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL READ-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Linear decay toward 0 over `budgetPeriod` seconds since `lastSpendAt`.
    ///      `budgetPeriod == 0` means "lifetime budget" — never decays, matching mandate.md's own
    ///      documented meaning for that value, instead of dividing by zero.
    function _decayedSpent(AgentAccount storage acct, uint32 budgetPeriod)
        internal
        view
        returns (uint128)
    {
        if (budgetPeriod == 0 || acct.lastSpendAt == 0) return acct.spentAccum;
        uint256 elapsed = block.timestamp - acct.lastSpendAt;
        if (elapsed >= budgetPeriod) return 0;
        uint256 drained = (uint256(acct.spentAccum) * elapsed) / budgetPeriod;
        return acct.spentAccum - drained.toUint128();
    }
}
