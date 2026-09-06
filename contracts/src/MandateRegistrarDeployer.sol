// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { IVerifiableFactory } from "contracts/interfaces/IVerifiableFactory.sol";
import { MandateRegistrar } from "contracts/MandateRegistrar.sol";

/// @title MandateRegistrarDeployer
/// @author Victor Okpukpan (@victorokpukpan_)
/// @custom:security-contact https://x.com/victorokpukpan_
/// @notice Deploys a single `MandateRegistrar`. Exists only because `MandateRegistrar`'s own
///         init bytecode is 19,642 bytes — a `MandateOrgFactory` that did `new MandateRegistrar(…)`
///         directly would inline that entire creation code into its own runtime bytecode and blow
///         the EIP-170 24,576-byte contract-size limit (measured against `DeploySepolia`'s
///         equivalent, which is already 24,352/24,576 doing nothing but this deployment plus three
///         `ETHRegistrar` calls). Splitting the deploy into its own tiny contract is the only way
///         to keep `MandateOrgFactory` under the limit; there is no other option short of shrinking
///         `MandateRegistrar` itself.
/// @dev Deliberately permissionless and stateless. A `MandateRegistrar` that owns no ENS name is
///      inert — `issueMandate` only writes into `ORG_ROOT_REGISTRY`, which is meaningless until
///      some 2LD is wired to point at it — so there is nothing here worth gating. `initialOwner`
///      is passed straight through as the org admin; this contract never becomes an owner and
///      never needs `Ownable2Step`'s `acceptOwnership` handshake.
contract MandateRegistrarDeployer {
    IVerifiableFactory public immutable VERIFIABLE_FACTORY;
    address public immutable USER_REGISTRY_IMPL;
    address public immutable RESOLVER_IMPL;

    event RegistrarDeployed(
        address indexed registrar, address indexed initialOwner, bytes32 indexed orgRootNode
    );

    constructor(IVerifiableFactory verifiableFactory, address userRegistryImpl, address resolverImpl) {
        VERIFIABLE_FACTORY = verifiableFactory;
        USER_REGISTRY_IMPL = userRegistryImpl;
        RESOLVER_IMPL = resolverImpl;
    }

    /// @notice Deploy one `MandateRegistrar` for `orgEnsName`, owned by `initialOwner`.
    /// @dev No validation here beyond what `MandateRegistrar`'s own constructor already does
    ///      (zero-address checks) — this contract adds no policy of its own, only bytecode
    ///      separation.
    function deploy(
        bytes32 orgRootNode,
        bytes calldata orgRootDnsEncoded,
        string calldata orgEnsName,
        address initialOwner
    ) external returns (MandateRegistrar registrar) {
        registrar = new MandateRegistrar(
            VERIFIABLE_FACTORY,
            USER_REGISTRY_IMPL,
            RESOLVER_IMPL,
            orgRootNode,
            orgRootDnsEncoded,
            orgEnsName,
            initialOwner
        );
        emit RegistrarDeployed(address(registrar), initialOwner, orgRootNode);
    }
}
