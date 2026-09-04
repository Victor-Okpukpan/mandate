// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title IETHRegistrar
/// @author Victor Okpukpan (@victorokpukpan_)
/// @notice Thin, test-only interface onto ENSv2 Sepolia's `ETHRegistrar` — used solely to register
///         a real 2LD in fork tests so `MandateRegistrar`'s org root registry can be wired as its
///         subregistry. Signatures resolved from the deployed bytecode's selector table via
///         openchain.xyz (`makeCommitment` = 0x1e966f07, `register` = 0xcff3e7c2), not from the ENS
///         docs (which omit `ETHRegistrar` from the published deployments list entirely).
interface IETHRegistrar {
    function isAvailable(string calldata label) external view returns (bool);

    function MIN_COMMITMENT_AGE() external view returns (uint256);

    function makeCommitment(
        string calldata label,
        address owner,
        bytes32 secret,
        address subregistry,
        address resolver,
        uint64 duration,
        bytes32 referrer
    ) external pure returns (bytes32);

    function commit(bytes32 commitment) external;

    function getRegisterPrice(string calldata label, uint64 duration, address paymentToken)
        external
        view
        returns (uint256);

    function register(
        string calldata label,
        address owner,
        bytes32 secret,
        address subregistry,
        address resolver,
        uint64 duration,
        address paymentToken,
        bytes32 referrer
    ) external;
}
