// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title IVerifiableFactory
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Thin interface onto `ensdomains/verifiable-factory`'s `VerifiableFactory` — deploys a
///         deterministic, verifiable UUPS proxy clone and atomically initializes it in one call.
///         Signature verified against the deployed Sepolia bytecode at `VerifiableFactory`
///         (0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef): `deployProxy(address,uint256,bytes)` is
///         `0x5d84121a`, present in the deployed code (the 2-arg overload is absent).
/// @dev `deployProxy` computes `outerSalt = keccak256(abi.encode(msg.sender, salt))` before
///      CREATE2, so two different callers can safely reuse the same `salt` value without
///      colliding. `data` is delegatecalled into `implementation` immediately after deployment —
///      for our resolver instances, this is the ABI-encoded call to
///      `PermissionedResolver.initialize(admin, roleBitmap, setters)`.
interface IVerifiableFactory {
    event ProxyDeployed(
        address indexed sender, address indexed proxy, uint256 salt, address implementation
    );

    error VerificationFailed(address proxy);

    /// @notice Deploy a new verifiable proxy clone and initialize it with `data`.
    /// @param implementation The implementation the proxy delegates to.
    /// @param salt Caller-chosen uniqueness value (mixed with `msg.sender` before CREATE2).
    /// @param data Calldata delegatecalled into `implementation` immediately after deployment.
    /// @return proxy The deployed proxy's address.
    function deployProxy(address implementation, uint256 salt, bytes memory data)
        external
        returns (address proxy);

    /// @notice Verify `proxy` was deployed by this factory and return its current implementation.
    function verifyContract(address proxy) external view returns (address implementation);
}
