// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import { IVerifiableFactory } from "contracts/interfaces/IVerifiableFactory.sol";

import { MockPermissionedResolver } from "contracts-test/mocks/MockPermissionedResolver.sol";
import { MockUserRegistry } from "contracts-test/mocks/MockUserRegistry.sol";

/// @title MockVerifiableFactory
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Stand-in for ENSv2's `VerifiableFactory`. The real factory clones a shared UUPS
///         implementation via CREATE2; this mock just deploys a fresh mock instance of whichever
///         type `implementation` names (configured once at construction) and calls its
///         `initialize(...)` directly — sufficient to drive `MandateRegistrar` without a fork.
contract MockVerifiableFactory is IVerifiableFactory {
    address public immutable USER_REGISTRY_MARKER;
    address public immutable RESOLVER_MARKER;

    constructor(address userRegistryMarker, address resolverMarker) {
        USER_REGISTRY_MARKER = userRegistryMarker;
        RESOLVER_MARKER = resolverMarker;
    }

    function deployProxy(address implementation, uint256, bytes memory data)
        external
        returns (address proxy)
    {
        if (implementation == USER_REGISTRY_MARKER) {
            proxy = address(new MockUserRegistry());
        } else if (implementation == RESOLVER_MARKER) {
            proxy = address(new MockPermissionedResolver());
        } else {
            revert("MockVerifiableFactory: unknown implementation marker");
        }

        (bool ok,) = proxy.call(data);
        require(ok, "MockVerifiableFactory: init failed");

        emit ProxyDeployed(msg.sender, proxy, 0, implementation);
    }

    function verifyContract(address proxy) external pure returns (address) {
        return proxy;
    }
}
