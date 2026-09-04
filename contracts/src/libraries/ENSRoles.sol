// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title ENSRoles
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Enhanced Access Control role constants for ENSv2's `PermissionedRegistry` and
///         `PermissionedResolver`, mirrored exactly from the deployed source — not the ENS docs
///         site, which states its role table is "not yet final and may change prior to mainnet
///         deployment." Pulled from `ensdomains/contracts-v2` (main branch):
///         `src/registry/libraries/RegistryRolesLib.sol` and
///         `src/resolver/libraries/PermissionedResolverLib.sol`.
/// @dev Each role occupies one nybble (4 bits); its admin counterpart is the same bit shifted
///      128 higher. Admin roles are settable only at a name's registration time — never after.
///      Cross-checked against the deployed Sepolia bytecode at `PermissionedResolverImpl`
///      (0x9eae5c2730a7dd16bdd1dee6421a1b91e3b0365e) and `UserRegistryImpl`
///      (0x624a25d67b59d587752ebec8dded8827dae52050): every function selector this library's
///      constants are used against is present in the deployed code.
library ENSRoles {
    // ------------------------------------------------------------------
    // PermissionedRegistry roles
    // ------------------------------------------------------------------

    uint256 internal constant ROLE_REGISTRAR = 1 << 0;
    uint256 internal constant ROLE_REGISTRAR_ADMIN = ROLE_REGISTRAR << 128;

    uint256 internal constant ROLE_REGISTER_RESERVED = 1 << 4;
    uint256 internal constant ROLE_REGISTER_RESERVED_ADMIN = ROLE_REGISTER_RESERVED << 128;

    uint256 internal constant ROLE_SET_PARENT = 1 << 8;
    uint256 internal constant ROLE_SET_PARENT_ADMIN = ROLE_SET_PARENT << 128;

    uint256 internal constant ROLE_UNREGISTER = 1 << 12;
    uint256 internal constant ROLE_UNREGISTER_ADMIN = ROLE_UNREGISTER << 128;

    uint256 internal constant ROLE_RENEW = 1 << 16;
    uint256 internal constant ROLE_RENEW_ADMIN = ROLE_RENEW << 128;

    uint256 internal constant ROLE_SET_SUBREGISTRY = 1 << 20;
    uint256 internal constant ROLE_SET_SUBREGISTRY_ADMIN = ROLE_SET_SUBREGISTRY << 128;

    uint256 internal constant ROLE_SET_RESOLVER = 1 << 24;
    uint256 internal constant ROLE_SET_RESOLVER_ADMIN = ROLE_SET_RESOLVER << 128;

    /// @dev Admin-only, no regular variant. Never include this in a mandate's roleBitmap — its
    ///      absence is what makes a mandate soulbound.
    uint256 internal constant ROLE_CAN_TRANSFER_ADMIN = (1 << 28) << 128;

    /// @dev Non-revokable tag the registry sets itself. Never pass this in a caller roleBitmap.
    uint256 internal constant ROLE_WAS_RESERVED = 1 << 32;

    uint256 internal constant ROLE_SET_URI = 1 << 36;
    uint256 internal constant ROLE_SET_URI_ADMIN = ROLE_SET_URI << 128;

    uint256 internal constant ROLE_CAN_NAME = 1 << 120;
    uint256 internal constant ROLE_CAN_NAME_ADMIN = ROLE_CAN_NAME << 128;

    uint256 internal constant ROLE_UPGRADE = 1 << 124;
    uint256 internal constant ROLE_UPGRADE_ADMIN = ROLE_UPGRADE << 128;

    // ------------------------------------------------------------------
    // PermissionedResolver roles
    // ------------------------------------------------------------------

    uint256 internal constant ROLE_SET_ADDR = 1 << 0;
    uint256 internal constant ROLE_SET_ADDR_ADMIN = ROLE_SET_ADDR << 128;

    uint256 internal constant ROLE_SET_TEXT = 1 << 4;
    uint256 internal constant ROLE_SET_TEXT_ADMIN = ROLE_SET_TEXT << 128;

    uint256 internal constant ROLE_SET_CONTENTHASH = 1 << 8;
    uint256 internal constant ROLE_SET_CONTENTHASH_ADMIN = ROLE_SET_CONTENTHASH << 128;

    uint256 internal constant ROLE_SET_PUBKEY = 1 << 12;
    uint256 internal constant ROLE_SET_PUBKEY_ADMIN = ROLE_SET_PUBKEY << 128;

    uint256 internal constant ROLE_SET_ABI = 1 << 16;
    uint256 internal constant ROLE_SET_ABI_ADMIN = ROLE_SET_ABI << 128;

    uint256 internal constant ROLE_SET_INTERFACE = 1 << 20;
    uint256 internal constant ROLE_SET_INTERFACE_ADMIN = ROLE_SET_INTERFACE << 128;

    uint256 internal constant ROLE_SET_NAME = 1 << 24;
    uint256 internal constant ROLE_SET_NAME_ADMIN = ROLE_SET_NAME << 128;

    /// @dev Root-only, never granted per-name.
    uint256 internal constant ROLE_SET_ALIAS = 1 << 28;
    uint256 internal constant ROLE_SET_ALIAS_ADMIN = ROLE_SET_ALIAS << 128;

    uint256 internal constant ROLE_CLEAR = 1 << 32;
    uint256 internal constant ROLE_CLEAR_ADMIN = ROLE_CLEAR << 128;

    uint256 internal constant ROLE_SET_DATA = 1 << 36;
    uint256 internal constant ROLE_SET_DATA_ADMIN = ROLE_SET_DATA << 128;

    uint256 internal constant ROOT_RESOURCE = 0;
}
