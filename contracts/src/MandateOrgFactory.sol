// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { Ownable } from "openzeppelin-contracts/access/Ownable.sol";
import { Ownable2Step } from "openzeppelin-contracts/access/Ownable2Step.sol";
import { IERC20 } from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {
    ReentrancyGuardTransient
} from "openzeppelin-contracts/utils/ReentrancyGuardTransient.sol";

import { IETHRegistrar } from "contracts/interfaces/IETHRegistrar.sol";
import { LibDNSEncode } from "contracts/libraries/LibDNSEncode.sol";
import { MandateRegistrar } from "contracts/MandateRegistrar.sol";
import { MandateRegistrarDeployer } from "contracts/MandateRegistrarDeployer.sol";

/// @title MandateOrgFactory
/// @author Victor Okpukpan (@victorokpukpan_)
/// @custom:security-contact https://x.com/victorokpukpan_
/// @notice Self-serve org onboarding — HOW-IT-WORKS.md §4: "a button, not a script." Turns two
///         manual `forge script` runs (`DeploySepolia.s.sol`'s `commit()`/`register()`, run a real
///         60+ seconds apart) into a two-call flow any connected wallet can drive: `beginOrg` then,
///         after ENSv2's own commit-reveal wait, `finalizeOrg`.
/// @dev Two-phase because `ETHRegistrar` enforces commit-reveal — one transaction is structurally
///      impossible, not a design choice made here.
///
///      Phase 1 DEPLOYS the registrar rather than precomputing its address with CREATE2. Its
///      `ORG_ROOT_REGISTRY` is a nested CREATE2 through `VerifiableFactory`, whose proxy init code
///      lives in a dependency this repo doesn't vendor and hasn't independently verified —
///      precomputing it would be exactly the kind of guess this codebase's interfaces repeatedly
///      refuse to make elsewhere (see `IERC8183Jobs`'s own NatSpec on unverified authorization).
///      Deploying first and reading `ORG_ROOT_REGISTRY()` off the real contract costs one extra
///      registrar if a label is later sniped, in exchange for never guessing.
///
///      Payment is real: `getRegisterPrice` is quoted fresh in `finalizeOrg` and pulled via
///      `safeTransferFrom` — this contract never mints anything, and `PAYMENT_TOKEN` is Circle's
///      real Sepolia USDC (0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238), not a project-specific
///      mock token. `getRegisterPrice` does revert `PaymentTokenNotSupported` for an arbitrary
///      token — confirmed live against a random address and against Sepolia WETH, both correctly
///      rejected — but the deployed Sepolia beta `ETHRegistrar`'s allowlist accepts Circle's real
///      USDC directly; confirmed with a full commit→register cycle actually paying in it on a
///      fork, not just the price quote. An earlier version of this contract used its own
///      permissionlessly-mintable `MockUSDC` instead, specifically so the onboarding wizard could
///      offer a zero-friction "get test USDC" button — that convenience was traded away in favor
///      of every org paying in the same real token every other Sepolia project already uses,
///      rather than one only this site's own button could produce. `PAYMENT_TOKEN` is immutable
///      because that choice, once a factory is deployed, shouldn't silently change under orgs
///      already using it.
///
///      Front-running: `makeCommitment` is `pure` and every argument is visible once `commit` is
///      submitted, but an observer cannot redirect the org — changing `owner` or `subregistry`
///      produces a commitment that was never committed, and `register` recomputes and requires a
///      matured, existing one. Two things an observer CAN do: (a) benign — register our exact
///      params with their own USDC, which leaves the org correctly wired and only makes
///      `finalizeOrg` revert `NameNoLongerAvailable` for us (call `abandonOrg` and move on); (b)
///      hostile — snipe the label to a different owner entirely, unfixable given
///      `MandateRegistrar`'s immutable `ORG_ROOT_NODE`, cost is gas only. Both are cleaned up by
///      `abandonOrg`, callable by the pending admin.
contract MandateOrgFactory is Ownable2Step, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    error MandateOrgFactory__ZeroAddress();
    error MandateOrgFactory__LabelUnavailable(string label);
    error MandateOrgFactory__NoSuchCommitment(bytes32 commitment);
    error MandateOrgFactory__CommitmentTooNew(uint256 age, uint256 minAge);
    error MandateOrgFactory__CommitmentExpired(uint256 age, uint256 maxAge);
    error MandateOrgFactory__NotPendingAdmin(address caller, address admin);

    event OrgCommitted(
        bytes32 indexed commitment,
        bytes32 indexed orgRootNode,
        address indexed admin,
        address registrar,
        address orgRootRegistry,
        string label,
        uint64 committedAt,
        uint64 duration
    );
    event OrgCreated(
        bytes32 indexed orgRootNode,
        address indexed registrar,
        address indexed admin,
        address orgRootRegistry,
        string orgEnsName,
        uint64 nameExpiry,
        uint256 pricePaid
    );
    event OrgAbandoned(bytes32 indexed commitment, bytes32 indexed orgRootNode, address registrar);

    struct PendingOrg {
        address registrar;
        uint64 committedAt;
        address admin;
        uint64 duration;
        bytes32 secret;
        string label;
    }

    struct Org {
        address registrar;
        address orgRootRegistry;
        address admin;
        uint64 createdAt;
        bytes32 orgRootNode;
        string orgEnsName;
    }

    IETHRegistrar public immutable ETH_REGISTRAR;
    MandateRegistrarDeployer public immutable DEPLOYER;
    IERC20 public immutable PAYMENT_TOKEN;

    bytes32 internal immutable ETH_NODE;
    bytes internal ETH_DNS;

    /// @dev ENSv2's own MIN_REGISTER_DURATION on Sepolia — mirrors DeploySepolia.s.sol's constant
    ///      rather than re-deriving it from the registrar, which exposes no such getter.
    uint64 public registrationDuration = 2_419_200;
    bytes32 public referrer;

    mapping(bytes32 commitment => PendingOrg) public pending;

    address[] public allRegistrars;
    mapping(bytes32 orgRootNode => address) public registrarOfNode;
    mapping(address registrar => Org) public orgs;
    /// @dev "Orgs this address created" — goes stale the moment a registrar's ownership transfers,
    ///      since this contract has no hook into `Ownable2Step`. Read `MandateRegistrar.owner()`
    ///      for current ownership; use this mapping only to find orgs to look up, never to prove
    ///      who currently controls one.
    mapping(address admin => address[]) internal _orgsOfAdmin;

    constructor(
        IETHRegistrar ethRegistrar,
        MandateRegistrarDeployer deployer,
        IERC20 paymentToken,
        bytes32 ethNode,
        bytes memory ethDns,
        address initialOwner
    ) Ownable(initialOwner) {
        if (
            address(ethRegistrar) == address(0) || address(deployer) == address(0)
                || address(paymentToken) == address(0)
        ) {
            revert MandateOrgFactory__ZeroAddress();
        }
        ETH_REGISTRAR = ethRegistrar;
        DEPLOYER = deployer;
        PAYMENT_TOKEN = paymentToken;
        ETH_NODE = ethNode;
        ETH_DNS = ethDns;
    }

    /// @notice Phase 1. Deploys `label`'s registrar, computes its ENSv2 commitment, and commits.
    /// @dev `secretSalt` is caller-supplied entropy folded into the on-chain secret, so two
    ///      concurrent callers for the same label never collide on `pending`'s key even before
    ///      either commits — the commitment itself, not the label, is the map key, and the
    ///      commitment already differs because each call deploys a fresh `orgRootRegistry`.
    function beginOrg(string calldata label, address admin, bytes32 secretSalt)
        external
        nonReentrant
        returns (bytes32 commitment, address registrar, address orgRootRegistry, bytes32 orgRootNode)
    {
        if (admin == address(0)) revert MandateOrgFactory__ZeroAddress();
        if (!ETH_REGISTRAR.isAvailable(label)) revert MandateOrgFactory__LabelUnavailable(label);

        string memory orgEnsName = string.concat(label, ".eth");
        bytes memory orgRootDns = LibDNSEncode.prependLabel(label, ETH_DNS);
        orgRootNode = LibDNSEncode.namehashChild(ETH_NODE, label);

        MandateRegistrar deployed = DEPLOYER.deploy(orgRootNode, orgRootDns, orgEnsName, admin);
        registrar = address(deployed);
        orgRootRegistry = address(deployed.ORG_ROOT_REGISTRY());

        bytes32 secret = keccak256(abi.encode(secretSalt, msg.sender, block.prevrandao));
        uint64 duration = registrationDuration;

        commitment = ETH_REGISTRAR.makeCommitment(
            label, admin, secret, orgRootRegistry, address(0), duration, referrer
        );

        pending[commitment] = PendingOrg({
            registrar: registrar,
            committedAt: uint64(block.timestamp),
            admin: admin,
            duration: duration,
            secret: secret,
            label: label
        });

        ETH_REGISTRAR.commit(commitment);

        emit OrgCommitted(
            commitment,
            orgRootNode,
            admin,
            registrar,
            orgRootRegistry,
            label,
            uint64(block.timestamp),
            duration
        );
    }

    /// @notice Phase 2. Quotes the real ENSv2 price, pulls it from the pending org's admin, and
    ///         registers the 2LD with `orgRootRegistry` wired as its subregistry.
    /// @dev Permissionless caller so a relayer can finish the flow, but payment is always pulled
    ///      from `pending[commitment].admin` — never `msg.sender` — so no third party can be
    ///      drained by finishing someone else's commitment, and exactly one admin approval covers
    ///      the whole two-phase flow regardless of who calls this.
    function finalizeOrg(bytes32 commitment)
        external
        nonReentrant
        returns (address registrar, uint256 pricePaid)
    {
        PendingOrg memory p = pending[commitment];
        if (p.registrar == address(0)) revert MandateOrgFactory__NoSuchCommitment(commitment);

        uint256 age = block.timestamp - p.committedAt;
        uint256 minAge = ETH_REGISTRAR.MIN_COMMITMENT_AGE();
        uint256 maxAge = ETH_REGISTRAR.MAX_COMMITMENT_AGE();
        if (age < minAge) revert MandateOrgFactory__CommitmentTooNew(age, minAge);
        if (age > maxAge) revert MandateOrgFactory__CommitmentExpired(age, maxAge);

        MandateRegistrar deployed = MandateRegistrar(p.registrar);
        address orgRootRegistry = address(deployed.ORG_ROOT_REGISTRY());
        bytes32 orgRootNode = deployed.ORG_ROOT_NODE();
        string memory orgEnsName = deployed.orgEnsName();

        pricePaid = ETH_REGISTRAR.getRegisterPrice(p.label, p.duration, address(PAYMENT_TOKEN));

        PAYMENT_TOKEN.safeTransferFrom(p.admin, address(this), pricePaid);
        PAYMENT_TOKEN.forceApprove(address(ETH_REGISTRAR), pricePaid);

        ETH_REGISTRAR.register(
            p.label, p.admin, p.secret, orgRootRegistry, address(0), p.duration, address(PAYMENT_TOKEN), referrer
        );

        PAYMENT_TOKEN.forceApprove(address(ETH_REGISTRAR), 0);

        registrar = p.registrar;
        allRegistrars.push(registrar);
        registrarOfNode[orgRootNode] = registrar;
        orgs[registrar] = Org({
            registrar: registrar,
            orgRootRegistry: orgRootRegistry,
            admin: p.admin,
            createdAt: uint64(block.timestamp),
            orgRootNode: orgRootNode,
            orgEnsName: orgEnsName
        });
        _orgsOfAdmin[p.admin].push(registrar);
        delete pending[commitment];

        emit OrgCreated(
            orgRootNode,
            registrar,
            p.admin,
            orgRootRegistry,
            orgEnsName,
            uint64(block.timestamp) + p.duration,
            pricePaid
        );
    }

    /// @notice Clean up a commitment that will never finalize — the label was sniped before us,
    ///         or the commitment aged past `MAX_COMMITMENT_AGE` and can no longer be revealed.
    function abandonOrg(bytes32 commitment) external {
        PendingOrg memory p = pending[commitment];
        if (p.registrar == address(0)) revert MandateOrgFactory__NoSuchCommitment(commitment);
        if (msg.sender != p.admin) revert MandateOrgFactory__NotPendingAdmin(msg.sender, p.admin);

        bytes32 orgRootNode = MandateRegistrar(p.registrar).ORG_ROOT_NODE();
        delete pending[commitment];
        emit OrgAbandoned(commitment, orgRootNode, p.registrar);
    }

    function orgCount() external view returns (uint256) {
        return allRegistrars.length;
    }

    function registrarsPaginated(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory page)
    {
        uint256 total = allRegistrars.length;
        if (offset >= total) return new address[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = allRegistrars[i];
        }
    }

    function orgsOfAdmin(address admin) external view returns (address[] memory) {
        return _orgsOfAdmin[admin];
    }

    function setRegistrationDuration(uint64 duration) external onlyOwner {
        registrationDuration = duration;
    }

    function setReferrer(bytes32 newReferrer) external onlyOwner {
        referrer = newReferrer;
    }

    /// @notice Recover any token accidentally sent here. This contract never holds
    ///         `PAYMENT_TOKEN` between transactions — `finalizeOrg`'s own transfer + approve +
    ///         register is atomic — so this is a rescue hatch, not a routine operation.
    function rescueToken(IERC20 token, address to) external onlyOwner {
        token.safeTransfer(to, token.balanceOf(address(this)));
    }
}
