// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { Script, console2 } from "forge-std/Script.sol";

import { IERC20 } from "openzeppelin-contracts/token/ERC20/IERC20.sol";

import { AgentTreasury } from "contracts/AgentTreasury.sol";
import { IERC8183Jobs } from "contracts/interfaces/IERC8183Jobs.sol";
import { MandateAnchor } from "contracts/MandateAnchor.sol";

/// @title DeployArc
/// @author Victor Okpukpan (@victorokpukpan_)
/// @custom:security-contact security@runmandate.xyz
/// @notice Deploys `MandateAnchor` and `AgentTreasury` on Arc testnet 5042002, wired against the
///         sponsor's own deployed USDC and ERC-8183 Jobs contracts. Does not touch Sepolia and
///         does not sync any mandate — that is the Enforcer's job once it is actually running
///         (`enforcer/`), not a one-shot deploy script's.
/// @dev Run with: `forge script script/DeployArc.s.sol --account $ACCOUNT --sender $SENDER
///      --rpc-url $ARC_RPC_URL --broadcast` — never with a plaintext key (see
///      contracts/README.md, and note Arc's dual-decimal USDC trap: this script deploys against
///      the ERC-20 face of it, decimals()=6, never the 18dp native-gas face — see
///      packages/shared/src/decimals.ts). Requires `ENFORCER_ADDRESS` and
///      `MANDATE_INITIAL_OWNER` in the environment; everything else falls back to the sponsor
///      addresses already in `.env.example`.
contract DeployArc is Script {
    /// @dev 15 minutes — matches `.env.example`'s `ENFORCER_MAX_STALENESS_SECONDS` default.
    uint64 internal constant DEFAULT_MAX_STALENESS = 900;
    /// @dev 10,000 USDC (6dp) — a generous single-draw ceiling for demo gas floats, not a
    ///      considered production value.
    uint128 internal constant DEFAULT_MAX_GAS_FLOAT = 10_000e6;
    /// @dev 100% — the demo harness deliberately does not exercise the utilisation cap; see
    ///      test/invariant/TreasuryInvariant.t.sol's NatSpec for the same choice and why.
    uint16 internal constant DEFAULT_UTILISATION_CAP_BPS = 10_000;
    uint16 internal constant DEFAULT_INTEREST_RATE_BPS = 0;

    function run() external returns (MandateAnchor anchor, AgentTreasury treasury) {
        address usdc = vm.envOr("ARC_USDC", address(0x3600000000000000000000000000000000000000));
        address jobs =
            vm.envOr("ARC_ERC8183_JOBS", address(0x0747EEf0706327138c69792bF28Cd525089e4583));

        address enforcerAddr = vm.envAddress("ENFORCER_ADDRESS");
        address initialOwner = vm.envAddress("MANDATE_INITIAL_OWNER");
        uint64 maxStaleness =
            uint64(vm.envOr("ENFORCER_MAX_STALENESS_SECONDS", uint256(DEFAULT_MAX_STALENESS)));

        vm.startBroadcast();

        anchor = new MandateAnchor(enforcerAddr, initialOwner, maxStaleness);
        treasury = new AgentTreasury(
            IERC20(usdc),
            anchor,
            IERC8183Jobs(jobs),
            initialOwner,
            DEFAULT_MAX_GAS_FLOAT,
            DEFAULT_UTILISATION_CAP_BPS,
            DEFAULT_INTEREST_RATE_BPS
        );

        vm.stopBroadcast();

        console2.log("MandateAnchor deployed:", address(anchor));
        console2.log("AgentTreasury deployed:", address(treasury));
        console2.log(
            "Set ARC_MANDATE_ANCHOR/ARC_AGENT_TREASURY and their NEXT_PUBLIC_ counterparts."
        );
    }
}
