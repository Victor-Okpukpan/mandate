// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { Ownable } from "openzeppelin-contracts/access/Ownable.sol";
import { Ownable2Step } from "openzeppelin-contracts/access/Ownable2Step.sol";
import {
    ReentrancyGuardTransient
} from "openzeppelin-contracts/utils/ReentrancyGuardTransient.sol";
import { Strings } from "openzeppelin-contracts/utils/Strings.sol";

import { IPermissionedResolver } from "contracts/interfaces/IPermissionedResolver.sol";
import { IUserRegistry } from "contracts/interfaces/IUserRegistry.sol";
import { IVerifiableFactory } from "contracts/interfaces/IVerifiableFactory.sol";
import { ENSRoles } from "contracts/libraries/ENSRoles.sol";
import { LibDNSEncode } from "contracts/libraries/LibDNSEncode.sol";
import { MandateKeys } from "contracts/libraries/MandateKeys.sol";

/// @title MandateRegistrar
/// @author Victor Okpukpan (@victorokpukpan_)
/// @custom:security-contact https://x.com/victorokpukpan_
/// @notice Issues, attenuates, amends, and revokes AI-agent mandates as ENSv2 subnames. A mandate
///         is a soulbound, self-expiring, instantly-revocable ENS name whose resolver records
///         encode its principal-controlled budget/allowlist/expiry terms — and whose per-key
///         `authorizeTextRoles` grants let the agent write only its own status, never its own
///         leash.
/// @dev Deliberate simplifications, disclosed rather than discovered:
///
///      - `issueMandate` only issues direct children of the org root. An agent grows its own
///        sub-tree exclusively through `attenuate`, self-service and narrowing-only — the org
///        never needs to reach into a sub-tree it didn't create, since `revokeMandate` (and the
///        registry roles `MandateRegistrar` always holds) already give it a kill switch anywhere
///        in the tree.
///      - A mandate's logical `terms.expiry` and its ENS name's on-chain registry expiry are
///        allowed to diverge in one direction only: amending a mandate to a SHORTER expiry never
///        shortens the underlying name (the registry's `renew()` cannot reduce expiry, and the
///        agent is never granted `ROLE_RENEW` to do it themselves either way). The name's registry
///        expiry is a hard backstop upper bound; `terms.expiry` — mirrored here and in the
///        resolver's `mandate.expires` text record — is what every enforcement check actually
///        reads. They only ever need to agree in the direction that matters: the mandate can never
///        outlive its name.
///      - A child inherits its parent's `allowlistRoot` **verbatim** rather than proving a subset:
///        proving one merkle root is a subset of another on-chain is expensive; inheriting makes
///        widening structurally impossible instead of merely checked. `attenuate` and
///        `amendMandate` silently overwrite any caller-supplied `allowlistRoot` for a non-root
///        mandate with its parent's — and, for a root-level mandate with no parent to force it
///        from, `amendMandate` forces it back to its own current value instead — so it is exactly
///        as immutable post-issuance everywhere in the tree. This is enforcement, not a bug to
///        work around.
///      - `amendMandate` shrinking a mandate's `expiry` or `perTxCap` does NOT cascade to that
///        mandate's already-issued children — there is no on-chain children index to walk (only
///        the running `committed` sum, which amendment DOES re-check against). A child keeps
///        spending under its own stored, now-stale-relative-to-its-tightened-parent cap until it is
///        itself re-amended or revoked directly. `allowlistRoot` immutability and the
///        `committed <= budgetTotal` ceiling are perpetually enforced on-chain (an invariant run
///        caught both missing before this note was added); numeric narrowing is currently a
///        point-in-time check only. See ARCHITECTURE.md's known-limitations section for why the
///        real fix belongs in the Enforcer, which already has the full parent→children graph from
///        indexing `MandateIssued` events to sync Arc.
contract MandateRegistrar is Ownable2Step, ReentrancyGuardTransient {
    using Strings for uint256;
    using Strings for address;

    /*//////////////////////////////////////////////////////////////
                            TYPE DECLARATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice The negotiable terms of a mandate. Mirrored into both registrar storage
    ///         (authoritative for attenuation/amendment checks) and the resolver's `mandate.*`
    ///         text records (authoritative for anyone resolving the name off-chain).
    // Field order packs into 3 storage slots instead of 4: allowlistRoot alone (32B), the two
    // uint128s together (32B exact), and expiry+budgetPeriod+maxDepth together (14B) — see
    // solskill rule 27. Declaration order here is the storage layout; keep it packed on any edit.
    struct MandateTerms {
        /// @dev Merkle root over allowed RECIPIENT addresses (not target+selector — see
        ///      `AgentTreasury`'s NatSpec for why the leaf binds the recipient).
        bytes32 allowlistRoot;
        /// @dev USDC, 6dp (ERC-20 convention — see packages/shared/src/decimals.ts).
        uint128 budgetTotal;
        uint128 perTxCap;
        /// @dev Upper bound on the ENS name's own registry expiry; see the contract-level note.
        uint64 expiry;
        /// @dev Rolling-decay window in seconds on Arc; 0 = lifetime budget, never decays.
        uint32 budgetPeriod;
        /// @dev Remaining sub-delegation depth. 0 = may not `attenuate` further.
        uint16 maxDepth;
    }

    /// @notice Full on-chain record of one issued mandate.
    struct Mandate {
        /// @dev This mandate's own node — namehash(label.<parent>). Stored on the struct itself
        ///      so code holding a `Mandate` (storage or memory) never needs it passed alongside.
        bytes32 node;
        MandateTerms terms;
        /// @dev The registry this name is registered IN (org root, or an ancestor's sub-registry).
        IUserRegistry registry;
        /// @dev This mandate's own dedicated resolver instance.
        IPermissionedResolver resolver;
        /// @dev The token this name was minted as, in `registry`. Stable for this mandate's whole
        ///      lifetime because its registry-level roleBitmap is always zero — we never call
        ///      `grantRoles`/`revokeRoles` on it again, so its token version never bumps.
        uint256 tokenId;
        address agentWallet;
        /// @dev bytes32(0) for a direct child of the org root.
        bytes32 parentNode;
        string label;
        /// @dev This mandate's own full DNS wire-format name — `label.<parent>` — needed to
        ///      `authorizeTextRoles` for this node's own children in a future `attenuate` call.
        bytes dnsEncodedName;
        /// @dev Sum of live children's `budgetTotal`, checked against `terms.budgetTotal` on every
        ///      `attenuate` — the allocation invariant (distinct from Arc's consumption ledger).
        uint128 committed;
        bool revoked;
        bool exists;
    }

    /*//////////////////////////////////////////////////////////////
                              STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    IVerifiableFactory public immutable VERIFIABLE_FACTORY;
    address public immutable USER_REGISTRY_IMPL;
    address public immutable RESOLVER_IMPL;

    /// @dev namehash(orgEnsName), e.g. namehash("acme.eth"). Informational parent identity for
    ///      root-level mandates; `ORG_ROOT_REGISTRY` is what issuance actually writes into.
    bytes32 public immutable ORG_ROOT_NODE;
    /// @dev This registrar's own org-level UserRegistry, deployed and owned by this contract at
    ///      construction. Direct mandate children live here; deeper nodes live in a sub-registry
    ///      deployed on that node's first `attenuate` call.
    IUserRegistry public immutable ORG_ROOT_REGISTRY;

    /// @dev DNS wire-format encoding of the org's root name, e.g. dnsEncode("acme.eth"). Computed
    ///      off-chain exactly once, at deployment — every descendant name is built from here purely
    ///      on-chain (`LibDNSEncode.prependLabel`), never re-trusting off-chain input again.
    bytes internal _orgRootDnsEncoded;
    /// @dev Human-readable org name for the `mandate.principal` text record, e.g. "acme.eth".
    string public orgEnsName;

    mapping(bytes32 node => Mandate) internal _mandates;
    /// @dev A node's OWN sub-registry, once it has attenuated at least one child. Unset (zero
    ///      address) until then.
    mapping(bytes32 node => IUserRegistry) public subRegistryOf;

    uint256 private _saltCounter;

    /*//////////////////////////////////////////////////////////////
                                  EVENTS
    //////////////////////////////////////////////////////////////*/

    event MandateIssued(
        bytes32 indexed node,
        bytes32 indexed parentNode,
        address indexed agentWallet,
        address resolver,
        bytes32 termsHash,
        uint64 expiry
    );
    event MandateAmended(bytes32 indexed node, bytes32 termsHash, uint64 expiry);
    event MandateRevoked(bytes32 indexed node, address indexed revokedBy, bytes32 reason);
    event SubRegistryDeployed(bytes32 indexed parentNode, address registry);
    event IdentityBound(bytes32 indexed node, uint256 erc8004Id, string model);

    /*//////////////////////////////////////////////////////////////
                                  ERRORS
    //////////////////////////////////////////////////////////////*/

    error MandateRegistrar__ZeroAddress();
    error MandateRegistrar__MandateNotFound(bytes32 node);
    error MandateRegistrar__MandateAlreadyExists(bytes32 node);
    error MandateRegistrar__MandateRevoked(bytes32 node);
    error MandateRegistrar__NotPrincipal(bytes32 node, address caller);
    error MandateRegistrar__ExpiryInPast(uint64 expiry);
    error MandateRegistrar__ParentExpired(bytes32 parentNode);
    error MandateRegistrar__DepthExhausted(bytes32 parentNode);
    error MandateRegistrar__ExpiryExceedsParent(uint64 requested, uint64 parentExpiry);
    error MandateRegistrar__PerTxCapExceedsParent(uint128 requested, uint128 parentCap);
    error MandateRegistrar__BudgetExceedsHeadroom(uint128 requested, uint128 headroom);
    error MandateRegistrar__AgentGrantFailed(address agentWallet);
    error MandateRegistrar__BudgetBelowCommitted(uint128 requested, uint128 committed);

    /*//////////////////////////////////////////////////////////////
                              INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /// @param verifiableFactory ENSv2's VerifiableFactory (deploys+initializes UUPS proxy clones).
    /// @param userRegistryImpl ENSv2's UserRegistryImpl address, to clone for every registry.
    /// @param resolverImpl ENSv2's PermissionedResolverImpl address, to clone for every mandate.
    /// @param orgRootNode namehash(orgEnsName_).
    /// @param orgRootDnsEncoded_ dnsEncode(orgEnsName_), computed off-chain exactly once.
    /// @param orgEnsName_ Human-readable org root name, e.g. "acme.eth".
    /// @param initialOwner The org admin. A multisig on mainnet; a plain EOA is a testnet-only
    ///        convenience — see contracts/README.md.
    constructor(
        IVerifiableFactory verifiableFactory,
        address userRegistryImpl,
        address resolverImpl,
        bytes32 orgRootNode,
        bytes memory orgRootDnsEncoded_,
        string memory orgEnsName_,
        address initialOwner
    ) Ownable(initialOwner) {
        if (
            address(verifiableFactory) == address(0) || userRegistryImpl == address(0)
                || resolverImpl == address(0) || initialOwner == address(0)
        ) {
            revert MandateRegistrar__ZeroAddress();
        }

        VERIFIABLE_FACTORY = verifiableFactory;
        USER_REGISTRY_IMPL = userRegistryImpl;
        RESOLVER_IMPL = resolverImpl;
        ORG_ROOT_NODE = orgRootNode;
        _orgRootDnsEncoded = orgRootDnsEncoded_;
        orgEnsName = orgEnsName_;

        address registry = verifiableFactory.deployProxy(
            userRegistryImpl,
            _nextSalt(),
            abi.encodeCall(IUserRegistry.initialize, (address(this), _registryRootRoleBitmap()))
        );
        ORG_ROOT_REGISTRY = IUserRegistry(registry);
    }

    /*//////////////////////////////////////////////////////////////
                    USER-FACING STATE-CHANGING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Issue a mandate directly under the org root. Org-admin only.
    /// @param label The agent's subname label, e.g. "research" for "research.acme.eth".
    /// @param agentWallet The agent's Privy server wallet — becomes the ENS name's owner, with
    ///        zero registry-level roles (soulbound, non-renewable-by-itself).
    /// @param terms The mandate's negotiable terms.
    /// @param arcWallet The agent's wallet on Arc, bound as `agent.arc.wallet` (often equal to
    ///        `agentWallet`, but kept distinct since ENS-side identity and Arc-side spending keys
    ///        are not required to be the same key).
    /// @param allowHumanJson Display-only JSON describing `terms.allowlistRoot`'s members, e.g.
    ///        `[{"target":"0x...","label":"ERC-8183 Jobs"}]` — never consumed by any contract,
    ///        purely for a human or judge reading the resolver's raw text records.
    function issueMandate(
        string calldata label,
        address agentWallet,
        MandateTerms calldata terms,
        address arcWallet,
        string calldata allowHumanJson
    ) external nonReentrant onlyOwner returns (bytes32 node, address resolver) {
        if (agentWallet == address(0) || arcWallet == address(0)) {
            revert MandateRegistrar__ZeroAddress();
        }
        if (terms.expiry <= block.timestamp) revert MandateRegistrar__ExpiryInPast(terms.expiry);

        (node, resolver) = _issue(
            bytes32(0),
            ORG_ROOT_REGISTRY,
            _orgRootDnsEncoded,
            label,
            agentWallet,
            terms,
            arcWallet,
            allowHumanJson
        );
    }

    /// @notice Delegate a narrower mandate to a sub-agent. Self-service: callable by the parent
    ///         mandate's own agent wallet (or the org admin, which always retains override
    ///         authority), never by anyone else.
    /// @dev Enforces monotonic narrowing: `child.expiry <= parent.expiry`,
    ///      `child.perTxCap <= parent.perTxCap`,
    ///      `child.budgetTotal <= parent.budgetTotal - parent.committed`,
    ///      `child.maxDepth == parent.maxDepth - 1`, and `child.allowlistRoot` is forced to
    ///      `parent.allowlistRoot` regardless of what is passed in.
    function attenuate(
        bytes32 parentNode,
        string calldata label,
        address subAgentWallet,
        MandateTerms calldata terms,
        address arcWallet,
        string calldata allowHumanJson
    ) external nonReentrant returns (bytes32 node, address resolver) {
        if (subAgentWallet == address(0) || arcWallet == address(0)) {
            revert MandateRegistrar__ZeroAddress();
        }
        if (terms.expiry <= block.timestamp) revert MandateRegistrar__ExpiryInPast(terms.expiry);

        Mandate storage parent = _mandateOrRevert(parentNode);
        if (msg.sender != owner() && msg.sender != parent.agentWallet) {
            revert MandateRegistrar__NotPrincipal(parentNode, msg.sender);
        }
        if (parent.revoked) revert MandateRegistrar__MandateRevoked(parentNode);
        if (parent.terms.expiry <= block.timestamp) {
            revert MandateRegistrar__ParentExpired(parentNode);
        }

        MandateTerms memory narrowed = _validateAttenuation(
            parentNode,
            parent.terms.maxDepth,
            parent.terms.expiry,
            parent.terms.perTxCap,
            parent.terms.budgetTotal,
            parent.committed,
            parent.terms.allowlistRoot,
            terms
        );

        IUserRegistry registry = _subRegistryOrDeploy(parentNode, parent);

        (node, resolver) = _issue(
            parentNode,
            registry,
            parent.dnsEncodedName,
            label,
            subAgentWallet,
            narrowed,
            arcWallet,
            allowHumanJson
        );

        parent.committed += narrowed.budgetTotal;
    }

    /// @notice Amend an existing mandate's terms. Callable by whoever could have issued it: the
    ///         org admin for a root-level mandate, or the parent's agent wallet for an attenuated
    ///         one (always with the org admin's standing override).
    /// @dev Re-validates the full narrowing invariant against the parent's CURRENT headroom for a
    ///      non-root mandate — an amendment can never grant itself more room than a fresh
    ///      `attenuate` call could. `allowlistRoot` is silently forced back to the parent's current
    ///      root for a non-root mandate, same as `attenuate` — and, for a root-level mandate with
    ///      no parent to force it from, forced back to its OWN current value instead, so it is
    ///      exactly as immutable post-issuance as every descendant's inherited copy of it (an
    ///      admin who could freely change it here would silently orphan every already-issued
    ///      descendant's inherited root, since amendment never cascades down the tree). Also
    ///      re-checked against this mandate's OWN `committed`: an amendment can never shrink
    ///      `budgetTotal` below what this mandate has already sub-delegated to its own children.
    // solhint-disable-next-line function-max-lines
    function amendMandate(bytes32 node, MandateTerms calldata terms) external nonReentrant {
        Mandate storage mandate = _mandateOrRevert(node);
        if (mandate.revoked) revert MandateRegistrar__MandateRevoked(node);
        if (msg.sender != _principalOf(mandate)) {
            revert MandateRegistrar__NotPrincipal(node, msg.sender);
        }
        if (terms.expiry <= block.timestamp) revert MandateRegistrar__ExpiryInPast(terms.expiry);

        MandateTerms memory finalTerms = terms;

        if (mandate.parentNode != bytes32(0)) {
            Mandate storage parent = _mandateOrRevert(mandate.parentNode);
            if (parent.revoked) revert MandateRegistrar__MandateRevoked(mandate.parentNode);

            // Headroom must exclude this mandate's own current commitment, since amending it
            // replaces rather than adds to what it already holds against the parent.
            finalTerms = _validateAttenuation(
                mandate.parentNode,
                parent.terms.maxDepth,
                parent.terms.expiry,
                parent.terms.perTxCap,
                parent.terms.budgetTotal,
                parent.committed - mandate.terms.budgetTotal,
                parent.terms.allowlistRoot,
                terms
            );
            parent.committed = parent.committed - mandate.terms.budgetTotal + finalTerms.budgetTotal;
        } else {
            finalTerms.allowlistRoot = mandate.terms.allowlistRoot;
        }

        if (finalTerms.budgetTotal < mandate.committed) {
            revert MandateRegistrar__BudgetBelowCommitted(finalTerms.budgetTotal, mandate.committed);
        }

        // Effects before interactions: commit the new terms to storage before any external call,
        // even though `nonReentrant` already closes the reentrancy window on its own.
        bytes32 termsHash = keccak256(abi.encode(finalTerms));
        mandate.terms = finalTerms;

        // The name's registry expiry only ever extends; terms.expiry can move either way, see
        // the contract-level NatSpec for why that's safe.
        uint64 registryExpiry = mandate.registry.getExpiry(mandate.tokenId);
        if (finalTerms.expiry > registryExpiry) {
            mandate.registry.renew(mandate.tokenId, finalTerms.expiry);
        }

        mandate.resolver.setText(node, MandateKeys.TERMS_HASH, _bytes32Hex(termsHash));
        mandate.resolver.setText(node, MandateKeys.EXPIRES, uint256(finalTerms.expiry).toString());
        mandate.resolver
            .setText(node, MandateKeys.BUDGET_TOTAL, uint256(finalTerms.budgetTotal).toString());
        mandate.resolver
            .setText(node, MandateKeys.BUDGET_PERIOD, uint256(finalTerms.budgetPeriod).toString());
        mandate.resolver
            .setText(node, MandateKeys.BUDGET_PER_TX, uint256(finalTerms.perTxCap).toString());
        mandate.resolver
            .setText(node, MandateKeys.ALLOW_ROOT, _bytes32Hex(finalTerms.allowlistRoot));
        mandate.resolver.setText(node, MandateKeys.DEPTH, uint256(finalTerms.maxDepth).toString());

        emit MandateAmended(node, termsHash, finalTerms.expiry);
    }

    /// @notice Revoke a mandate immediately. Callable by the org admin (always, anywhere in the
    ///         tree) or by the immediate parent's agent wallet (an agent may fire its own
    ///         sub-agent). Cascades: does not recursively revoke descendants on-chain (gas), but
    ///         every descendant's `assertSpend` fails the moment its own ancestry is checked
    ///         off-chain by the Enforcer — see MandateAnchor's staleness/revocation design.
    function revokeMandate(bytes32 node, bytes32 reason) external nonReentrant {
        Mandate storage mandate = _mandateOrRevert(node);
        if (mandate.revoked) revert MandateRegistrar__MandateRevoked(node);

        bool isImmediateParent;
        if (mandate.parentNode != bytes32(0)) {
            Mandate storage parent = _mandates[mandate.parentNode];
            isImmediateParent = parent.exists && msg.sender == parent.agentWallet;
        }
        if (msg.sender != owner() && !isImmediateParent) {
            revert MandateRegistrar__NotPrincipal(node, msg.sender);
        }

        mandate.revoked = true;
        if (mandate.parentNode != bytes32(0)) {
            Mandate storage parent = _mandates[mandate.parentNode];
            if (parent.exists) {
                parent.committed -= mandate.terms.budgetTotal;
            }
        }

        // Effects before interactions: both storage writes above land before this external call,
        // even though `nonReentrant` already closes the reentrancy window on its own.
        mandate.registry.unregister(mandate.tokenId);

        emit MandateRevoked(node, msg.sender, reason);
    }

    /// @notice Bind (or update) an agent's ERC-8004 identity + declared model, after the fact —
    ///         the agent typically registers with ERC-8004 on Arc using the wallet this mandate
    ///         already names, which happens after issuance, not before.
    function bindIdentity(bytes32 node, uint256 erc8004Id, string calldata model)
        external
        nonReentrant
    {
        Mandate storage mandate = _mandateOrRevert(node);
        if (mandate.revoked) revert MandateRegistrar__MandateRevoked(node);
        if (msg.sender != _principalOf(mandate)) {
            revert MandateRegistrar__NotPrincipal(node, msg.sender);
        }

        mandate.resolver.setText(node, MandateKeys.ERC8004_ID, erc8004Id.toString());
        mandate.resolver.setText(node, MandateKeys.MODEL, model);

        emit IdentityBound(node, erc8004Id, model);
    }

    /*//////////////////////////////////////////////////////////////
                    USER-FACING READ-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function termsOf(bytes32 node) external view returns (MandateTerms memory) {
        return _mandateOrRevert(node).terms;
    }

    function mandateHash(bytes32 node) external view returns (bytes32) {
        return keccak256(abi.encode(_mandateOrRevert(node).terms));
    }

    function getMandate(bytes32 node) external view returns (Mandate memory) {
        return _mandateOrRevert(node);
    }

    /// @notice The account authorized to amend/revoke `node`: the org admin for a root-level
    ///         mandate, or the parent's agent wallet for an attenuated one.
    function principalOf(bytes32 node) external view returns (address) {
        return _principalOf(_mandateOrRevert(node));
    }

    function orgRootDnsEncoded() external view returns (bytes memory) {
        return _orgRootDnsEncoded;
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL STATE-CHANGING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Shared issuance path for both `issueMandate` and `attenuate`: deploys a dedicated
    ///      resolver (`mandate.*`/binding records written in its `initialize()` batch, per-key
    ///      agent grants as separate calls immediately after — see `_grantAgentKeys`'s NatSpec for
    ///      why those can't share the same batch), registers the name with a zero registry-level
    ///      roleBitmap (soulbound, non-renewable-by-the-agent by omission), and mirrors the mandate
    ///      into storage. Still one on-chain transaction end to end, just not one `initialize()` call.
    // solhint-disable-next-line function-max-lines
    function _issue(
        bytes32 parentNode,
        IUserRegistry registry,
        bytes memory parentDnsEncoded,
        string calldata label,
        address agentWallet,
        MandateTerms memory terms,
        address arcWallet,
        string calldata allowHumanJson
    ) internal returns (bytes32 node, address resolverAddr) {
        bytes32 parentHashSeed = parentNode == bytes32(0) ? ORG_ROOT_NODE : parentNode;
        node = LibDNSEncode.namehashChild(parentHashSeed, label);
        if (_mandates[node].exists) revert MandateRegistrar__MandateAlreadyExists(node);

        bytes memory dnsEncoded = LibDNSEncode.prependLabel(label, parentDnsEncoded);
        bytes32 termsHash = keccak256(abi.encode(terms));

        // Only the `mandate.*`/binding records go in the init batch: PermissionedResolver skips
        // permission checks for direct setters (setText et al.) while `_isInitializing()`, but NOT
        // for the authorize* grant path — see `_grantAgentKeys`'s NatSpec for why the per-key agent
        // grants have to happen as separate calls after deployment instead.
        bytes[] memory setters = new bytes[](13);
        _writeMandateRecords(setters, node, terms, termsHash, arcWallet, allowHumanJson);

        resolverAddr = VERIFIABLE_FACTORY.deployProxy(
            RESOLVER_IMPL,
            _nextSalt(),
            abi.encodeCall(
                IPermissionedResolver.initialize,
                (address(this), _resolverRootRoleBitmap(), setters)
            )
        );
        _grantAgentKeys(IPermissionedResolver(resolverAddr), dnsEncoded, agentWallet);

        // Registry-level roleBitmap is deliberately 0: no ROLE_CAN_TRANSFER_ADMIN (soulbound), no
        // ROLE_RENEW (self-expiring), no ROLE_SET_RESOLVER / ROLE_SET_SUBREGISTRY (immutable
        // wiring). Every capability the agent has lives on the resolver, scoped per-key.
        uint256 tokenId =
            registry.register(label, agentWallet, address(0), resolverAddr, 0, terms.expiry);

        Mandate storage mandate = _mandates[node];
        mandate.node = node;
        mandate.terms = terms;
        mandate.registry = registry;
        mandate.resolver = IPermissionedResolver(resolverAddr);
        mandate.tokenId = tokenId;
        mandate.agentWallet = agentWallet;
        mandate.parentNode = parentNode;
        mandate.label = label;
        mandate.dnsEncodedName = dnsEncoded;
        mandate.exists = true;

        emit MandateIssued(node, parentNode, agentWallet, resolverAddr, termsHash, terms.expiry);
    }

    /// @dev Deploys `parentNode`'s own sub-registry on its first `attenuate` call, wiring it as
    ///      the parent name's child registry so its descendants form a genuine sub-namespace
    ///      rather than living as flat siblings under the org root.
    function _subRegistryOrDeploy(bytes32 parentNode, Mandate storage parent)
        internal
        returns (IUserRegistry)
    {
        IUserRegistry existing = subRegistryOf[parentNode];
        if (address(existing) != address(0)) return existing;

        address registry = VERIFIABLE_FACTORY.deployProxy(
            USER_REGISTRY_IMPL,
            _nextSalt(),
            abi.encodeCall(IUserRegistry.initialize, (address(this), _registryRootRoleBitmap()))
        );

        parent.registry.setSubregistry(parent.tokenId, registry);
        subRegistryOf[parentNode] = IUserRegistry(registry);

        emit SubRegistryDeployed(parentNode, registry);
        return IUserRegistry(registry);
    }

    function _nextSalt() internal returns (uint256) {
        return ++_saltCounter;
    }

    /*//////////////////////////////////////////////////////////////
                    INTERNAL READ-ONLY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _mandateOrRevert(bytes32 node) internal view returns (Mandate storage mandate) {
        mandate = _mandates[node];
        if (!mandate.exists) revert MandateRegistrar__MandateNotFound(node);
    }

    function _principalOf(Mandate storage mandate) internal view returns (address) {
        if (mandate.parentNode == bytes32(0)) return owner();
        Mandate storage parent = _mandates[mandate.parentNode];
        return parent.exists ? parent.agentWallet : owner();
    }

    /// @dev Monotonic narrowing, checked against plain fields (not a `Mandate` reference) so both
    ///      `attenuate` (storage parent) and `amendMandate` (a memory pseudo-parent with headroom
    ///      already adjusted) share one implementation without a storage/memory overload — solc's
    ///      overload resolution does not treat those as sufficiently distinct. `allowlistRoot` is
    ///      always forced to the parent's — see the contract-level NatSpec on why that's
    ///      inheritance, not a subset check.
    function _validateAttenuation(
        bytes32 parentNode,
        uint16 parentMaxDepth,
        uint64 parentExpiry,
        uint128 parentPerTxCap,
        uint128 parentBudgetTotal,
        uint128 parentCommitted,
        bytes32 parentAllowlistRoot,
        MandateTerms calldata terms
    ) internal pure returns (MandateTerms memory narrowed) {
        if (parentMaxDepth == 0) {
            revert MandateRegistrar__DepthExhausted(parentNode);
        }
        if (terms.expiry > parentExpiry) {
            revert MandateRegistrar__ExpiryExceedsParent(terms.expiry, parentExpiry);
        }
        if (terms.perTxCap > parentPerTxCap) {
            revert MandateRegistrar__PerTxCapExceedsParent(terms.perTxCap, parentPerTxCap);
        }
        uint128 headroom = parentBudgetTotal - parentCommitted;
        if (terms.budgetTotal > headroom) {
            revert MandateRegistrar__BudgetExceedsHeadroom(terms.budgetTotal, headroom);
        }

        narrowed = terms;
        narrowed.allowlistRoot = parentAllowlistRoot;
        narrowed.maxDepth = parentMaxDepth - 1;
    }

    function _registryRootRoleBitmap() internal pure returns (uint256) {
        return ENSRoles.ROLE_REGISTRAR | ENSRoles.ROLE_RENEW | ENSRoles.ROLE_UNREGISTER
            | ENSRoles.ROLE_SET_SUBREGISTRY | ENSRoles.ROLE_SET_RESOLVER | ENSRoles.ROLE_UPGRADE
            | ENSRoles.ROLE_UPGRADE_ADMIN;
    }

    /// @dev Both the ADMIN bits (to later call `authorizeTextRoles`/`authorizeAddrRoles`/
    ///      `authorizeDataRoles` for amendments) and the regular bits (to call `setText` directly,
    ///      e.g. `bindIdentity`) — the admin variant alone only grants the right to delegate the
    ///      permission, not to hold it.
    function _resolverRootRoleBitmap() internal pure returns (uint256) {
        return ENSRoles.ROLE_SET_TEXT | ENSRoles.ROLE_SET_TEXT_ADMIN | ENSRoles.ROLE_SET_ADDR
            | ENSRoles.ROLE_SET_ADDR_ADMIN | ENSRoles.ROLE_SET_DATA | ENSRoles.ROLE_SET_DATA_ADMIN
            | ENSRoles.ROLE_UPGRADE | ENSRoles.ROLE_UPGRADE_ADMIN;
    }

    /// @dev The `mandate.*` and binding records — principal-writable only.
    function _writeMandateRecords(
        bytes[] memory setters,
        bytes32 node,
        MandateTerms memory terms,
        bytes32 termsHash,
        address arcWallet,
        string calldata allowHumanJson
    ) internal view {
        setters[0] = abi.encodeCall(IPermissionedResolver.setText, (node, MandateKeys.VERSION, "1"));
        setters[1] = abi.encodeCall(
            IPermissionedResolver.setText, (node, MandateKeys.PRINCIPAL, orgEnsName)
        );
        setters[2] = abi.encodeCall(
            IPermissionedResolver.setText, (node, MandateKeys.TERMS_HASH, _bytes32Hex(termsHash))
        );
        setters[3] = abi.encodeCall(
            IPermissionedResolver.setText,
            (node, MandateKeys.EXPIRES, uint256(terms.expiry).toString())
        );
        setters[4] = abi.encodeCall(
            IPermissionedResolver.setText,
            (node, MandateKeys.BUDGET_TOTAL, uint256(terms.budgetTotal).toString())
        );
        setters[5] = abi.encodeCall(
            IPermissionedResolver.setText,
            (node, MandateKeys.BUDGET_PERIOD, uint256(terms.budgetPeriod).toString())
        );
        setters[6] = abi.encodeCall(
            IPermissionedResolver.setText,
            (node, MandateKeys.BUDGET_PER_TX, uint256(terms.perTxCap).toString())
        );
        setters[7] = abi.encodeCall(
            IPermissionedResolver.setText,
            (node, MandateKeys.ALLOW_ROOT, _bytes32Hex(terms.allowlistRoot))
        );
        setters[8] = abi.encodeCall(
            IPermissionedResolver.setText, (node, MandateKeys.ALLOW_HUMAN, allowHumanJson)
        );
        setters[9] = abi.encodeCall(
            IPermissionedResolver.setText,
            (node, MandateKeys.DEPTH, uint256(terms.maxDepth).toString())
        );
        setters[10] = abi.encodeCall(
            IPermissionedResolver.setText, (node, MandateKeys.ARC_WALLET, arcWallet.toHexString())
        );
        setters[11] =
            abi.encodeCall(IPermissionedResolver.setText, (node, MandateKeys.ERC8004_ID, "0"));
        setters[12] = abi.encodeCall(IPermissionedResolver.setText, (node, MandateKeys.MODEL, ""));
    }

    /// @dev Per-key agent grants — never a name-level ROLE_SET_TEXT. This is the whole security
    ///      argument: the agent can write its status, never its own leash.
    ///
    ///      Deliberately NOT part of the resolver's `initialize()` setters batch, even though
    ///      `setText` calls are: `PermissionedResolver._checkRoles` skips permission checks while
    ///      `_isInitializing()`, so direct setters succeed regardless of caller. But
    ///      `authorizeTextRoles`'s grant path goes through `_checkCanGrantRoles`, which is NOT
    ///      routed through that override — and since `initialize()` is invoked by
    ///      `VerifiableFactory.deployProxy()` and `multicall()` relays via `delegatecall` (which
    ///      preserves the original caller), `msg.sender` throughout the whole init batch is the
    ///      factory, not `MandateRegistrar` — so a grant call inside that batch would need the
    ///      factory itself to hold admin rights, which would leave it with standing privilege over
    ///      every mandate's resolver. Calling these as ordinary external calls after deployment
    ///      instead makes `MandateRegistrar` — which the init call already made admin — the actual
    ///      `msg.sender`, and costs nothing but three extra calls in the same transaction.
    function _grantAgentKeys(
        IPermissionedResolver resolver,
        bytes memory dnsEncoded,
        address agentWallet
    ) internal {
        bool statusOk = resolver.authorizeTextRoles(
            dnsEncoded, MandateKeys.STATUS, agentWallet, true
        );
        bool heartbeatOk =
            resolver.authorizeTextRoles(dnsEncoded, MandateKeys.HEARTBEAT, agentWallet, true);
        bool outputOk =
            resolver.authorizeTextRoles(dnsEncoded, MandateKeys.OUTPUT_LAST, agentWallet, true);
        // Every grant is against a brand-new resolver instance's brand-new node, so each must be a
        // genuine state change. A `false` here means the resolver's grant semantics silently
        // diverged from what this contract was built against — fail loudly, not quietly.
        if (!statusOk || !heartbeatOk || !outputOk) {
            revert MandateRegistrar__AgentGrantFailed(agentWallet);
        }
    }

    function _bytes32Hex(bytes32 value) internal pure returns (string memory) {
        return uint256(value).toHexString(32);
    }
}
