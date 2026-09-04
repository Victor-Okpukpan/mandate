// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import { IPermissionedRegistry } from "contracts/interfaces/IPermissionedRegistry.sol";

/// @title IUserRegistry
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice `UserRegistry` — the UUPS-upgradeable `PermissionedRegistry` deployed as a fresh proxy
///         per org (and per attenuating agent) via `VerifiableFactory`. Signature verified against
///         the deployed Sepolia bytecode at `UserRegistryImpl`
///         (0x624a25d67b59d587752ebec8dded8827dae52050): `initialize(address,uint256)` is
///         `0xcd6dc687`, present in the deployed code.
interface IUserRegistry is IPermissionedRegistry {
    /// @notice Initialize a freshly-deployed proxy instance, granting `roleBitmap` to `rootAccount`
    ///         on `ROOT_RESOURCE`. Reverts on the zero address.
    function initialize(address rootAccount, uint256 roleBitmap) external;
}
