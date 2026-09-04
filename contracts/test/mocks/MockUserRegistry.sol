// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { IUserRegistry } from "contracts/interfaces/IUserRegistry.sol";

/// @title MockUserRegistry
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Minimal, deliberately simplified stand-in for ENSv2's `UserRegistry` — good enough to
///         drive `MandateRegistrar`'s own business logic (narrowing, headroom, revocation
///         bookkeeping) in fast, network-independent fuzz tests. Real ENSv2 permission semantics
///         (token versioning, EAC role scoping, expiry-state transitions) are exercised against
///         the actual deployed contracts in `test/fork/MandateRegistrarFork.t.sol` instead — this
///         mock is not a substitute for that, and re-implementing that behavior here would just be
///         testing a reimplementation of ENS against itself.
contract MockUserRegistry is IUserRegistry {
    mapping(uint256 tokenId => address) internal _owners;
    mapping(uint256 tokenId => uint64) internal _expiries;
    mapping(uint256 tokenId => address) internal _resolvers;
    mapping(uint256 tokenId => address) internal _subregistries;
    mapping(uint256 tokenId => mapping(address => uint256)) internal _roles;
    mapping(string label => uint256) internal _labelTokenId;

    function initialize(address, uint256) external { }

    function register(
        string memory label,
        address owner,
        address registry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId) {
        tokenId = uint256(keccak256(bytes(label)));
        _owners[tokenId] = owner;
        _expiries[tokenId] = expiry;
        _resolvers[tokenId] = resolver;
        _subregistries[tokenId] = registry;
        _roles[tokenId][owner] = roleBitmap;
        _labelTokenId[label] = tokenId;
    }

    function renew(uint256 tokenId, uint64 newExpiry) external {
        require(newExpiry >= _expiries[tokenId], "MockUserRegistry: cannot reduce expiry");
        _expiries[tokenId] = newExpiry;
    }

    function unregister(uint256 tokenId) external {
        _owners[tokenId] = address(0);
        _expiries[tokenId] = uint64(block.timestamp);
    }

    function setResolver(uint256 tokenId, address resolver) external {
        _resolvers[tokenId] = resolver;
    }

    function setSubregistry(uint256 tokenId, address registry) external {
        _subregistries[tokenId] = registry;
    }

    function setParent(address, string memory) external { }

    function getSubregistry(string calldata label) external view returns (address) {
        return _subregistries[_labelTokenId[label]];
    }

    function getResolver(string calldata label) external view returns (address) {
        return _resolvers[_labelTokenId[label]];
    }

    function getParent() external pure returns (address, string memory) {
        return (address(0), "");
    }

    function getExpiry(uint256 tokenId) external view returns (uint64) {
        return _expiries[tokenId];
    }

    function getResource(uint256 tokenId) external pure returns (uint256) {
        return tokenId;
    }

    function getTokenId(uint256 tokenId) external pure returns (uint256) {
        return tokenId;
    }

    function getOwner(uint256 tokenId) external view returns (address) {
        return block.timestamp >= _expiries[tokenId] ? address(0) : _owners[tokenId];
    }

    function getState(uint256 tokenId) external view returns (State memory state) {
        state.expiry = _expiries[tokenId];
        state.tokenId = tokenId;
        state.resource = tokenId;
        state.latestOwner = _owners[tokenId];
        state.status = block.timestamp >= _expiries[tokenId]
            ? Status.AVAILABLE
            : (_owners[tokenId] == address(0) ? Status.RESERVED : Status.REGISTERED);
    }

    function latestOwnerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }

    function findTokenId(string calldata label) external view returns (uint256) {
        return _labelTokenId[label];
    }

    function findOwner(string calldata label) external view returns (address) {
        return _owners[_labelTokenId[label]];
    }

    function findExpiry(string calldata label) external view returns (uint64) {
        return _expiries[_labelTokenId[label]];
    }

    function ROOT_RESOURCE() external pure returns (uint256) {
        return 0;
    }

    function hasRoles(uint256 resource, uint256 roleBitmap, address account)
        external
        view
        returns (bool)
    {
        return _roles[resource][account] & roleBitmap == roleBitmap;
    }

    function hasRootRoles(uint256, address) external pure returns (bool) {
        return true;
    }

    function roles(uint256 resource, address account) external view returns (uint256) {
        return _roles[resource][account];
    }

    function roleCount(uint256) external pure returns (uint256) {
        return 0;
    }

    function grantRoles(uint256 resource, uint256 roleBitmap, address account)
        external
        returns (bool)
    {
        _roles[resource][account] |= roleBitmap;
        return true;
    }

    function revokeRoles(uint256 resource, uint256 roleBitmap, address account)
        external
        returns (bool)
    {
        _roles[resource][account] &= ~roleBitmap;
        return true;
    }

    function grantRootRoles(uint256, address) external pure { }

    function revokeRootRoles(uint256, address) external pure { }
}
