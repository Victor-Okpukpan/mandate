// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { IPermissionedResolver } from "contracts/interfaces/IPermissionedResolver.sol";

/// @title MockPermissionedResolver
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Deliberately permissive stand-in for ENSv2's `PermissionedResolver` — records every
///         `setText` and accepts every `authorize*Roles` call unconditionally. The real per-key
///         permission model (the actual security property — can the agent write its own budget?)
///         is exercised against the real deployed contract in
///         `test/fork/MandateRegistrarFork.t.sol`; this mock exists only so `MandateRegistrar`'s
///         own narrowing/accounting logic can be fuzzed fast, without a fork.
contract MockPermissionedResolver is IPermissionedResolver {
    mapping(bytes32 node => mapping(string key => string)) internal _texts;
    mapping(bytes32 node => uint64) internal _versions;

    function initialize(address, uint256, bytes[] calldata setters) external {
        for (uint256 i; i < setters.length; ++i) {
            (bool ok,) = address(this).delegatecall(setters[i]);
            require(ok, "MockPermissionedResolver: setter failed");
        }
    }

    function authorizeTextRoles(bytes calldata, string calldata, address, bool)
        external
        pure
        returns (bool)
    {
        return true;
    }

    function authorizeAddrRoles(bytes calldata, uint256, address, bool)
        external
        pure
        returns (bool)
    {
        return true;
    }

    function authorizeDataRoles(bytes calldata, string calldata, address, bool)
        external
        pure
        returns (bool)
    {
        return true;
    }

    function authorizeNameRoles(bytes calldata, uint256, address, bool)
        external
        pure
        returns (bool)
    {
        return true;
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        _texts[node][key] = value;
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return _texts[node][key];
    }

    function setAddr(bytes32, address) external pure { }

    function setAddr(bytes32, uint256, bytes memory) external pure { }

    function addr(bytes32) external pure returns (address payable) {
        return payable(address(0));
    }

    function addr(bytes32, uint256) external pure returns (bytes memory) {
        return "";
    }

    function setData(bytes32, string calldata, bytes calldata) external pure { }

    function data(bytes32, string calldata) external pure returns (bytes memory) {
        return "";
    }

    function clearRecords(bytes32 node) external {
        _versions[node]++;
    }

    function recordVersions(bytes32 node) external view returns (uint64) {
        return _versions[node];
    }

    function ROOT_RESOURCE() external pure returns (uint256) {
        return 0;
    }

    function hasRoles(uint256, uint256, address) external pure returns (bool) {
        return true;
    }

    function hasRootRoles(uint256, address) external pure returns (bool) {
        return true;
    }

    function roles(uint256, address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function roleCount(uint256) external pure returns (uint256) {
        return 0;
    }

    function grantRoles(uint256, uint256, address) external pure returns (bool) {
        return true;
    }

    function revokeRoles(uint256, uint256, address) external pure returns (bool) {
        return true;
    }

    function grantRootRoles(uint256, address) external pure { }

    function revokeRootRoles(uint256, address) external pure { }
}
