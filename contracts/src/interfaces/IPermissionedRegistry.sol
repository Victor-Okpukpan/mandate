// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import { IEnhancedAccessControl } from "contracts/interfaces/IEnhancedAccessControl.sol";

/// @title IPermissionedRegistry
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Thin interface onto ENSv2's `PermissionedRegistry` / `UserRegistry` — a tokenized
///         (ERC1155) registry with resource-scoped access control for subdomain management.
///         Signatures verified against the deployed Sepolia bytecode at `UserRegistryImpl`
///         (0x624a25d67b59d587752ebec8dded8827dae52050) and `ETHRegistry`
///         (0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2), and cross-checked against
///         `ensdomains/contracts-v2`'s `src/registry/PermissionedRegistry.sol` (main branch).
/// @dev `anyId` accepts a labelhash, tokenId, or resource interchangeably — the registry zeroes
///      version bits internally to resolve any of them to the canonical storage slot. Token IDs
///      mutate on re-registration and on any role grant/revoke; never cache one across a role
///      change.
interface IPermissionedRegistry is IEnhancedAccessControl {
    enum Status {
        AVAILABLE,
        RESERVED,
        REGISTERED
    }

    struct State {
        uint64 expiry;
        uint256 tokenId;
        uint256 resource;
        address latestOwner;
        Status status;
    }

    /// @notice Register `label` under this registry.
    /// @dev Requires `ROLE_REGISTRAR` on `ROOT_RESOURCE` when the name is `AVAILABLE`. Admin
    ///      roles (the upper 128 bits of `roleBitmap`) are only settable here, at registration —
    ///      never again afterwards via `grantRoles`.
    function register(
        string memory label,
        address owner,
        address registry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId);

    /// @notice Extend `anyId`'s expiry. Requires `ROLE_RENEW`. Cannot reduce expiry.
    function renew(uint256 anyId, uint64 newExpiry) external;

    /// @notice Burn `anyId`'s token and set its expiry to now. Requires `ROLE_UNREGISTER`.
    function unregister(uint256 anyId) external;

    /// @notice Repoint `anyId`'s resolver. Requires `ROLE_SET_RESOLVER`.
    function setResolver(uint256 anyId, address resolver) external;

    /// @notice Repoint `anyId`'s child registry. Requires `ROLE_SET_SUBREGISTRY`.
    function setSubregistry(uint256 anyId, address registry) external;

    /// @notice Set this registry's own parent pointer. Requires `ROLE_SET_PARENT` on root.
    function setParent(address parent, string memory label) external;

    function getSubregistry(string calldata label) external view returns (address);

    function getResolver(string calldata label) external view returns (address);

    function getParent() external view returns (address parent, string memory label);

    function getExpiry(uint256 anyId) external view returns (uint64);

    function getResource(uint256 anyId) external view returns (uint256);

    function getTokenId(uint256 anyId) external view returns (uint256);

    function getOwner(uint256 anyId) external view returns (address);

    function getState(uint256 anyId) external view returns (State memory);

    function latestOwnerOf(uint256 tokenId) external view returns (address);

    function ownerOf(uint256 tokenId) external view returns (address);

    function findTokenId(string calldata label) external view returns (uint256);

    function findOwner(string calldata label) external view returns (address);

    function findExpiry(string calldata label) external view returns (uint64);
}
