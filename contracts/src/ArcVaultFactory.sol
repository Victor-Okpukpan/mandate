// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { Ownable } from "openzeppelin-contracts/access/Ownable.sol";
import { Ownable2Step } from "openzeppelin-contracts/access/Ownable2Step.sol";
import { IERC20 } from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import { AgentTreasury } from "contracts/AgentTreasury.sol";
import { IERC8183Jobs } from "contracts/interfaces/IERC8183Jobs.sol";
import { MandateAnchor } from "contracts/MandateAnchor.sol";

/// @title ArcVaultFactory
/// @author Victor Okpukpan (@victorokpukpan_)
/// @custom:security-contact https://x.com/victorokpukpan_
/// @notice Self-serve per-org Arc deployment — HOW-IT-WORKS.md §4 step 4, "Switch to Arc, Create
///         vault." One call deploys the org's own `MandateAnchor` + `AgentTreasury`, replacing
///         `script/DeployArc.s.sol`'s manual run.
/// @dev Deployment order is strictly anchor-then-treasury with no circularity to manage:
///      `AgentTreasury.ANCHOR` is immutable and `MandateAnchor` holds no reference back to any
///      treasury at all — verified by reading both constructors, not assumed. Combined init
///      bytecode is small enough (~11KB) that no `MandateRegistrarDeployer`-style split is needed
///      here; `forge build --sizes` is still the check, not this comment.
///
///      `USDC` and `JOBS` are immutable, factory-wide, not per-call: a per-call `usdc` would let
///      anyone list a vault pointed at a token the Enforcer has no reason to trust, and Arc has
///      exactly one real USDC and one real Jobs deployment to point at. `maxStaleness` /
///      `maxGasFloat` / `utilisationCapBps` / `interestRateBps` are factory-wide defaults an org
///      retunes afterward through `MandateAnchor`/`AgentTreasury`'s own existing `onlyOwner`
///      setters — `createVault`'s signature stays exactly `(admin, enforcer)` per the design doc.
///      `enforcer` is the one thing worth taking per-call: it is the one field an org may
///      legitimately want to self-host, and `MandateAnchor.proposeEnforcer` timelocks changing it
///      24h, so getting it right at construction matters.
///
///      `orgRootNode` in `VaultCreated` is an ASSERTION, not a verified on-chain link — nothing
///      on Arc can check that a given Sepolia registrar exists or is owned by the same admin. It
///      exists purely so the Enforcer can join `MandateOrgFactory.OrgCreated` (Sepolia) to
///      `VaultCreated` (Arc) by node instead of maintaining an off-chain mapping file. The actual
///      safety property is the Enforcer refusing to serve a vault unless
///      `MandateAnchor.owner() == MandateRegistrar.owner()` on the two claimed contracts — that
///      check lives in the Enforcer, not here, and does not cover an org using different admin
///      keys per chain.
contract ArcVaultFactory is Ownable2Step {
    error ArcVaultFactory__ZeroAddress();

    event VaultCreated(
        address indexed admin,
        address indexed anchor,
        address indexed treasury,
        address enforcer,
        bytes32 orgRootNode,
        uint64 maxStaleness,
        uint64 createdAt
    );

    struct Vault {
        address anchor;
        address treasury;
        address admin;
        bytes32 orgRootNode;
        uint64 createdAt;
    }

    IERC20 public immutable USDC;
    IERC8183Jobs public immutable JOBS;

    uint64 public defaultMaxStaleness = 900;
    uint128 public defaultMaxGasFloat = 10_000e6;
    uint16 public defaultUtilisationCapBps = 10_000;
    uint16 public defaultInterestRateBps = 0;

    address[] public allAnchors;
    mapping(address anchor => Vault) public vaults;
    mapping(address admin => address[]) internal _vaultsOfAdmin;

    constructor(IERC20 usdc, IERC8183Jobs jobs, address initialOwner) Ownable(initialOwner) {
        if (address(usdc) == address(0) || address(jobs) == address(0)) {
            revert ArcVaultFactory__ZeroAddress();
        }
        USDC = usdc;
        JOBS = jobs;
    }

    /// @notice Deploy `admin`'s own `MandateAnchor` + `AgentTreasury`, signed for by `enforcer`.
    function createVault(address admin, address enforcer)
        external
        returns (address anchor, address treasury)
    {
        return createVaultFor(admin, enforcer, bytes32(0));
    }

    /// @notice Same as `createVault`, tagging the vault with the Sepolia `orgRootNode` it belongs
    ///         to so the Enforcer can join the two chains' events without an off-chain mapping.
    ///         See this contract's own NatSpec on why that tag is an assertion, not a proof.
    function createVaultFor(address admin, address enforcer, bytes32 orgRootNode)
        public
        returns (address anchor, address treasury)
    {
        if (admin == address(0) || enforcer == address(0)) revert ArcVaultFactory__ZeroAddress();

        MandateAnchor deployedAnchor = new MandateAnchor(enforcer, admin, defaultMaxStaleness);
        AgentTreasury deployedTreasury = new AgentTreasury(
            USDC,
            deployedAnchor,
            JOBS,
            admin,
            defaultMaxGasFloat,
            defaultUtilisationCapBps,
            defaultInterestRateBps
        );

        anchor = address(deployedAnchor);
        treasury = address(deployedTreasury);

        allAnchors.push(anchor);
        vaults[anchor] = Vault({
            anchor: anchor,
            treasury: treasury,
            admin: admin,
            orgRootNode: orgRootNode,
            createdAt: uint64(block.timestamp)
        });
        _vaultsOfAdmin[admin].push(anchor);

        emit VaultCreated(
            admin, anchor, treasury, enforcer, orgRootNode, defaultMaxStaleness, uint64(block.timestamp)
        );
    }

    function vaultCount() external view returns (uint256) {
        return allAnchors.length;
    }

    function vaultsOfAdmin(address admin) external view returns (address[] memory) {
        return _vaultsOfAdmin[admin];
    }

    function setDefaultMaxStaleness(uint64 maxStaleness_) external onlyOwner {
        defaultMaxStaleness = maxStaleness_;
    }

    function setDefaultMaxGasFloat(uint128 maxGasFloat_) external onlyOwner {
        defaultMaxGasFloat = maxGasFloat_;
    }

    function setDefaultUtilisationCapBps(uint16 bps) external onlyOwner {
        defaultUtilisationCapBps = bps;
    }

    function setDefaultInterestRateBps(uint16 bps) external onlyOwner {
        defaultInterestRateBps = bps;
    }
}
