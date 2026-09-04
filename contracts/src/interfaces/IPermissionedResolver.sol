// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import { IEnhancedAccessControl } from "contracts/interfaces/IEnhancedAccessControl.sol";

/// @title IPermissionedResolver
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Thin interface onto ENSv2's `PermissionedResolver` — the resolver every mandate gets
///         its own instance of. Signatures verified against the deployed Sepolia bytecode at
///         `PermissionedResolverImpl` (0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e), and
///         cross-checked against `ensdomains/contracts-v2`'s `src/resolver/PermissionedResolver.sol`
///         (main branch).
/// @dev Fine-grained permissions, the feature this whole project is built on:
///        - `setText(node, key, ...)` requires `ROLE_SET_TEXT` scoped to
///          `resource(node, keccak256(bytes(key)))` — granted per-key via `authorizeTextRoles`.
///        - `authorizeTextRoles` itself requires the CALLER to hold `ROLE_SET_TEXT_ADMIN` on
///          `resource(node, 0)` (the whole-node resource).
///        - `grantRoles`/`revokeRoles` are permanently disabled on this contract — reverts always.
///          Use `authorizeTextRoles` / `authorizeAddrRoles` / `authorizeDataRoles` /
///          `authorizeNameRoles` instead.
/// @dev ⚠️ `initialize()`'s permission-check bypass covers direct setters (`setText` et al.) ONLY
///      — verified on Sepolia fork. `authorizeTextRoles`'s grant path is a separate internal check
///      NOT covered by that bypass, and `multicall()`'s `delegatecall` relay preserves whatever
///      `msg.sender` called `initialize()` (the factory that deployed this proxy, not the intended
///      admin) throughout the whole batch — so a grant call placed inside the init batch fails
///      unless the FACTORY itself already holds admin rights, which nothing should ever grant it.
///      `MandateRegistrar` calls `authorizeTextRoles` as ordinary external calls after deployment
///      instead, once it is genuinely `msg.sender`. See `MandateRegistrar._grantAgentKeys`.
interface IPermissionedResolver is IEnhancedAccessControl {
    /// @notice Initialize a freshly-deployed proxy: grant `roleBitmap` to `admin` on
    ///         `ROOT_RESOURCE`, then run `setters` as a batch whose direct setters (not
    ///         `authorize*Roles` calls) skip permission checks.
    function initialize(address admin, uint256 roleBitmap, bytes[] calldata setters) external;

    /// @notice Authorize `setText(key)` for `account` on `toName` (DNS wire-format).
    /// @dev Caller must hold `ROLE_SET_TEXT_ADMIN` on `resource(namehash(toName), 0)`.
    function authorizeTextRoles(
        bytes calldata toName,
        string calldata key,
        address account,
        bool grant
    ) external returns (bool);

    /// @notice Authorize `setAddr(coinType)` for `account` on `toName` (DNS wire-format).
    function authorizeAddrRoles(
        bytes calldata toName,
        uint256 coinType,
        address account,
        bool grant
    ) external returns (bool);

    /// @notice Authorize `setData(key)` for `account` on `toName` (DNS wire-format).
    function authorizeDataRoles(
        bytes calldata toName,
        string calldata key,
        address account,
        bool grant
    ) external returns (bool);

    /// @notice Authorize `roleBitmap` for `account` on `toName` (DNS wire-format), name-scoped.
    function authorizeNameRoles(
        bytes calldata toName,
        uint256 roleBitmap,
        address account,
        bool grant
    ) external returns (bool);

    function setText(bytes32 node, string calldata key, string calldata value) external;

    function text(bytes32 node, string calldata key) external view returns (string memory);

    function setAddr(bytes32 node, address addr_) external;

    function setAddr(bytes32 node, uint256 coinType, bytes memory addressBytes) external;

    function addr(bytes32 node) external view returns (address payable);

    function addr(bytes32 node, uint256 coinType) external view returns (bytes memory);

    function setData(bytes32 node, string calldata key, bytes calldata value) external;

    function data(bytes32 node, string calldata key) external view returns (bytes memory);

    /// @notice Wipe every record for `node` by bumping its version. Requires `ROLE_CLEAR`.
    function clearRecords(bytes32 node) external;

    function recordVersions(bytes32 node) external view returns (uint64);
}
