// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title IEnhancedAccessControl
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice The resource-scoped, nybble-packed role system shared by ENSv2's `PermissionedRegistry`
///         and `PermissionedResolver`. Thin interface onto a contract we compose, not rewrite —
///         signatures verified against the deployed Sepolia bytecode at `UserRegistryImpl`
///         (0x624a25d67b59d587752ebec8dded8827dae52050) and `PermissionedResolverImpl`
///         (0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e).
/// @dev `ROOT_RESOURCE` (0x0) is a fallback resource: roles granted there apply globally across
///      every other resource on the same contract instance.
interface IEnhancedAccessControl {
    function ROOT_RESOURCE() external view returns (uint256);

    function hasRoles(uint256 resource, uint256 roleBitmap, address account)
        external
        view
        returns (bool);

    function hasRootRoles(uint256 roleBitmap, address account) external view returns (bool);

    function roles(uint256 resource, address account) external view returns (uint256);

    function roleCount(uint256 resource) external view returns (uint256);

    function grantRoles(uint256 resource, uint256 roleBitmap, address account)
        external
        returns (bool);

    function revokeRoles(uint256 resource, uint256 roleBitmap, address account)
        external
        returns (bool);

    function grantRootRoles(uint256 roleBitmap, address account) external;

    function revokeRootRoles(uint256 roleBitmap, address account) external;
}
