// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { Ownable } from "openzeppelin-contracts/access/Ownable.sol";
import { Ownable2Step } from "openzeppelin-contracts/access/Ownable2Step.sol";
import { ECDSA } from "openzeppelin-contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "openzeppelin-contracts/utils/cryptography/EIP712.sol";
import { MerkleProof } from "openzeppelin-contracts/utils/cryptography/MerkleProof.sol";

/// @title MandateAnchor
/// @author Victor Okpukpan (@victorokpukpan_)
/// @custom:security-contact security@runmandate.xyz
/// @notice The Arc-side shadow of ENS mandate state, written only by the Enforcer's key via
///         EIP-712 signed payloads. `assertSpend` is the gate every spend on Arc must pass —
///         and it fails closed: a dead or censored Enforcer freezes every agent instead of
///         leaving them unsupervised.
/// @dev The Enforcer is a propagator, not an authority: it can only ever narrow a mandate or
///      revoke it, never widen one, and everything it writes here is independently verifiable —
///      anyone can recompute `syncMandate`'s EIP-712 hash and confirm the Enforcer's signature
///      against the mandate ENS actually holds on Sepolia.
///
///      Deliberate simplification versus the original spec: no separate `revoke()` entry point.
///      `syncMandate` with `payload.revoked = true` covers it — one signing scheme, one code path,
///      same nonce-monotonicity guarantee, and revocation is really just the most extreme kind of
///      narrowing this contract already exists to enforce.
contract MandateAnchor is Ownable2Step, EIP712 {
    using ECDSA for bytes32;

    /*//////////////////////////////////////////////////////////////
                            TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice The Arc-side shadow of one agent's mandate. Field order packs into 4 storage slots.
    struct Anchor {
        bytes32 termsHash;
        /// @dev Merkle root over allowed RECIPIENT addresses — see `AgentTreasury`'s NatSpec.
        bytes32 allowlistRoot;
        uint128 budgetTotal;
        uint128 perTxCap;
        uint64 expiry;
        uint32 budgetPeriod;
        /// @dev Bumped by every `syncMandate` and every `heartbeat` — the fail-closed clock.
        uint64 updatedAt;
        /// @dev Strictly monotonic; rejects replay and out-of-order `syncMandate` calls.
        uint64 nonce;
        bool revoked;
    }

    /// @notice The EIP-712 payload the Enforcer signs to sync (or revoke, via `revoked: true`) a
    ///         mandate. Field order matches mandate.md §5.3 — this is user(Enforcer)-facing wire
    ///         format, kept faithful to the spec independent of `Anchor`'s packed storage order.
    struct SyncPayload {
        address agent;
        bytes32 node;
        bytes32 termsHash;
        uint64 expiry;
        uint128 budgetTotal;
        uint32 budgetPeriod;
        uint128 perTxCap;
        bytes32 allowlistRoot;
        uint64 nonce;
        bool revoked;
    }

    /*//////////////////////////////////////////////////////////////
                              STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    // solhint-disable max-line-length, gas-small-strings
    // These are canonical EIP-712 type signature strings — the exact bytes the spec requires to
    // derive the correct type hash. Wrapping or shortening them would change the hash and break
    // every signature an Enforcer or wallet produces against this contract.
    bytes32 internal constant SYNC_PAYLOAD_TYPEHASH = keccak256(
        "SyncPayload(address agent,bytes32 node,bytes32 termsHash,uint64 expiry,uint128 budgetTotal,uint32 budgetPeriod,uint128 perTxCap,bytes32 allowlistRoot,uint64 nonce,bool revoked)"
    );

    bytes32 internal constant HEARTBEAT_TYPEHASH =
        keccak256("HeartbeatPayload(address agent,uint64 deadline)");
    // solhint-enable max-line-length, gas-small-strings

    /// @dev A change of enforcer key is timelocked — see `proposeEnforcer`/`executeEnforcerChange`.
    uint256 public constant ENFORCER_CHANGE_DELAY = 24 hours;

    address public enforcer;
    address public pendingEnforcer;
    uint256 public pendingEnforcerEta;

    /// @notice Max seconds an anchor may go unsynced/unheartbeat-ed before every spend against it
    ///         fails closed. This is the best security property in the project — say it out loud.
    uint64 public maxStaleness;

    mapping(address agent => Anchor) public anchors;
    mapping(bytes32 node => address) public agentOf;

    /*//////////////////////////////////////////////////////////////
                                  EVENTS
    //////////////////////////////////////////////////////////////*/

    event MandateSynced(
        address indexed agent, bytes32 indexed node, bytes32 termsHash, uint64 nonce, bool revoked
    );
    event Heartbeat(address indexed agent, uint64 updatedAt);
    event MaxStalenessUpdated(uint64 maxStaleness);
    event EnforcerChangeProposed(address indexed newEnforcer, uint256 eta);
    event EnforcerChanged(address indexed enforcer);

    /*//////////////////////////////////////////////////////////////
                                  ERRORS
    //////////////////////////////////////////////////////////////*/

    error MandateAnchor__ZeroAddress();
    error MandateAnchor__InvalidSignature();
    error MandateAnchor__NonceNotMonotonic(uint64 provided, uint64 current);
    error MandateAnchor__NoPendingEnforcer();
    error MandateAnchor__TimelockNotElapsed(uint256 eta);
    error MandateAnchor__Revoked(address agent);
    error MandateAnchor__Expired(address agent, uint64 expiry);
    error MandateAnchor__PerTxCapExceeded(uint256 amount, uint128 perTxCap);
    error MandateAnchor__NotAllowlisted(address recipient);
    error MandateAnchor__Stale(address agent, uint64 updatedAt, uint64 maxStaleness);

    /*//////////////////////////////////////////////////////////////
                              INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /// @param initialEnforcer The Enforcer's signing key. A testnet EOA — see contracts/README.md.
    /// @param initialOwner The org admin, gating `proposeEnforcer`/`executeEnforcerChange` and
    ///        `setMaxStaleness`. A multisig on mainnet.
    /// @param maxStaleness_ Seconds an anchor may go unsynced before spends against it freeze.
    constructor(address initialEnforcer, address initialOwner, uint64 maxStaleness_)
        Ownable(initialOwner)
        EIP712("MandateAnchor", "1")
    {
        if (initialEnforcer == address(0)) revert MandateAnchor__ZeroAddress();
        enforcer = initialEnforcer;
        maxStaleness = maxStaleness_;
    }

    /*//////////////////////////////////////////////////////////////
                    USER-FACING STATE-CHANGING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Sync (or revoke, via `payload.revoked = true`) an agent's anchor from a signed
    ///         Enforcer payload. Permissionless to submit — anyone can relay a valid signature;
    ///         only the Enforcer's key can produce one.
    function syncMandate(SyncPayload calldata payload, bytes calldata enforcerSig) external {
        Anchor storage anchor = anchors[payload.agent];
        bool isFirstSync = anchor.updatedAt == 0;
        if (!isFirstSync && payload.nonce <= anchor.nonce) {
            revert MandateAnchor__NonceNotMonotonic(payload.nonce, anchor.nonce);
        }

        bytes32 structHash = keccak256(
            abi.encode(
                SYNC_PAYLOAD_TYPEHASH,
                payload.agent,
                payload.node,
                payload.termsHash,
                payload.expiry,
                payload.budgetTotal,
                payload.budgetPeriod,
                payload.perTxCap,
                payload.allowlistRoot,
                payload.nonce,
                payload.revoked
            )
        );
        _verifyEnforcerSignature(structHash, enforcerSig);

        anchor.termsHash = payload.termsHash;
        anchor.allowlistRoot = payload.allowlistRoot;
        anchor.budgetTotal = payload.budgetTotal;
        anchor.perTxCap = payload.perTxCap;
        anchor.expiry = payload.expiry;
        anchor.budgetPeriod = payload.budgetPeriod;
        anchor.updatedAt = uint64(block.timestamp);
        anchor.nonce = payload.nonce;
        anchor.revoked = payload.revoked;
        agentOf[payload.node] = payload.agent;

        emit MandateSynced(
            payload.agent, payload.node, payload.termsHash, payload.nonce, payload.revoked
        );
    }

    /// @notice Bump `agent`'s `updatedAt` without touching its terms — the Enforcer's keepalive,
    ///         so a healthy Enforcer doesn't need to re-sign a full `SyncPayload` (and bump the
    ///         nonce) just to prove it's still alive. Permissionless to submit, like `syncMandate`.
    /// @dev No nonce: replaying an old-but-unexpired heartbeat only ever bumps `updatedAt` to now,
    ///      which is always safe. `deadline` bounds how long a signature stays replayable instead —
    ///      the Enforcer signs short-lived heartbeats (§ maxStaleness/3) so a stale one can't be
    ///      replayed to keep an agent alive past when the Enforcer would otherwise let it freeze.
    function heartbeat(address agent, uint64 deadline, bytes calldata enforcerSig) external {
        if (block.timestamp > deadline) revert MandateAnchor__InvalidSignature();

        bytes32 structHash = keccak256(abi.encode(HEARTBEAT_TYPEHASH, agent, deadline));
        _verifyEnforcerSignature(structHash, enforcerSig);

        anchors[agent].updatedAt = uint64(block.timestamp);
        emit Heartbeat(agent, uint64(block.timestamp));
    }

    /// @notice Propose a new Enforcer key. Takes effect only after `ENFORCER_CHANGE_DELAY`, via
    ///         `executeEnforcerChange` — changing who can write mandate state is exactly the kind
    ///         of action a compromised owner key should not be able to do instantly.
    function proposeEnforcer(address newEnforcer) external onlyOwner {
        if (newEnforcer == address(0)) revert MandateAnchor__ZeroAddress();
        pendingEnforcer = newEnforcer;
        pendingEnforcerEta = block.timestamp + ENFORCER_CHANGE_DELAY;
        emit EnforcerChangeProposed(newEnforcer, pendingEnforcerEta);
    }

    function executeEnforcerChange() external onlyOwner {
        if (pendingEnforcer == address(0)) revert MandateAnchor__NoPendingEnforcer();
        if (block.timestamp < pendingEnforcerEta) {
            revert MandateAnchor__TimelockNotElapsed(pendingEnforcerEta);
        }

        enforcer = pendingEnforcer;
        pendingEnforcer = address(0);
        pendingEnforcerEta = 0;
        emit EnforcerChanged(enforcer);
    }

    /// @notice Lower or raise the staleness tolerance. Not timelocked — tightening it is strictly
    ///         safer, and loosening it is a minor risk next to changing who holds the signing key.
    function setMaxStaleness(uint64 newMaxStaleness) external onlyOwner {
        maxStaleness = newMaxStaleness;
        emit MaxStalenessUpdated(newMaxStaleness);
    }

    /*//////////////////////////////////////////////////////////////
                    USER-FACING READ-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Reverts unless `agent` may pay `recipient` up to `amount` right now. Callers pass
    ///         `proof` against the anchor's OWN `allowlistRoot` — a merkle proof of membership for
    ///         `keccak256(abi.encodePacked(recipient))`, matching `AgentTreasury`'s and
    ///         `packages/shared/src/merkle.ts`'s recipient-keyed leaves (see `AgentTreasury`'s
    ///         NatSpec for why the leaf binds the recipient rather than a target+selector pair).
    /// @dev Reverts, in order: revoked · expired · over the per-tx cap · not allowlisted · stale.
    ///      This function does NOT check the cumulative rolling budget — that ledger lives on
    ///      `AgentTreasury`, which calls this first and then checks its own `spentInWindow`
    ///      afterward. Two different jobs: this is the fast stateless pre-filter's on-chain twin;
    ///      the cumulative budget is the authoritative, stateful half.
    function assertSpend(address agent, address recipient, uint256 amount, bytes32[] calldata proof)
        external
        view
    {
        Anchor storage anchor = anchors[agent];

        if (anchor.revoked) revert MandateAnchor__Revoked(agent);
        if (block.timestamp >= anchor.expiry) revert MandateAnchor__Expired(agent, anchor.expiry);
        if (amount > anchor.perTxCap) {
            revert MandateAnchor__PerTxCapExceeded(amount, anchor.perTxCap);
        }

        bytes32 leaf = keccak256(abi.encodePacked(recipient));
        if (!MerkleProof.verify(proof, anchor.allowlistRoot, leaf)) {
            revert MandateAnchor__NotAllowlisted(recipient);
        }

        // Fail closed: a dead or censored Enforcer freezes every agent instead of leaving them
        // unsupervised. Checked last so a caller sees the more specific reason first when both
        // apply — staleness is the generic "nobody's watching" catch-all.
        if (block.timestamp > anchor.updatedAt + maxStaleness) {
            revert MandateAnchor__Stale(agent, anchor.updatedAt, maxStaleness);
        }
    }

    /// @notice The two fields `AgentTreasury` needs for its own leaky-bucket budget ledger,
    ///         without hand-destructuring `anchors`'s full 9-field tuple at every call site.
    function budgetOf(address agent)
        external
        view
        returns (uint128 budgetTotal, uint32 budgetPeriod)
    {
        Anchor storage anchor = anchors[agent];
        return (anchor.budgetTotal, anchor.budgetPeriod);
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL READ-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _verifyEnforcerSignature(bytes32 structHash, bytes calldata signature) internal view {
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        if (signer != enforcer) revert MandateAnchor__InvalidSignature();
    }
}
