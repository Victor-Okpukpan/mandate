// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import { Script, console2 } from "forge-std/Script.sol";

import { MandateRegistrar } from "contracts/MandateRegistrar.sol";

/// @title SeedDemo
/// @author Victor Okpukpan (@victorokpukpan_)
/// @custom:security-contact security@runmandate.xyz
/// @notice Issues two demo mandates — "research" and "ops", matching the naming already used
///         throughout the test suite and the landing page's own hero replay — against an
///         already-deployed `MandateRegistrar` on Sepolia. Deliberately Sepolia-only: a single
///         `forge script` run targets one RPC/chain, and the only genuinely useful "seeding" left
///         after `DeploySepolia`/`DeployArc` is issuing the ENS side of the demo, since Arc-side
///         liquidity is one `deposit()` call an operator can send directly
///         (`cast send $ARC_AGENT_TREASURY "deposit(uint256)" <amount> --account $ACCOUNT`)
///         without needing a dedicated script.
/// @dev Also deliberately does NOT sign or submit any `MandateAnchor.syncMandate` call — pushing
///      a mandate's terms to Arc is the Enforcer's job (`enforcer/`), which watches
///      `MandateIssued` and signs with its own key. A demo-seed script holding that key, even
///      temporarily, would be exactly the kind of plaintext-key exception this repo's Solidity
///      conventions exist to prevent outside of Anvil. Run the Enforcer for real after this script
///      to get these two mandates mirrored onto Arc.
/// @dev Run with: `forge script script/SeedDemo.s.sol --account $ACCOUNT --sender $SENDER
///      --rpc-url $SEPOLIA_RPC_URL --broadcast`. Requires `SEPOLIA_MANDATE_REGISTRAR` (from
///      `DeploySepolia`'s output), `DEMO_RESEARCH_AGENT_WALLET`, `DEMO_OPS_AGENT_WALLET`, and
///      `DEMO_ARC_WALLET` in the environment — real, controllable testnet addresses, not
///      placeholders, since whoever runs the demo afterward needs to actually hold these keys.
contract SeedDemo is Script {
    uint128 internal constant DEMO_BUDGET_TOTAL = 500_000_000; // 500 USDC, 6dp
    uint128 internal constant DEMO_PER_TX_CAP = 50_000_000; // 50 USDC
    uint64 internal constant DEMO_DURATION = 7 days;
    uint32 internal constant DEMO_BUDGET_PERIOD = 1 days;
    uint16 internal constant DEMO_MAX_DEPTH = 2;

    function run() external {
        MandateRegistrar registrar = MandateRegistrar(vm.envAddress("SEPOLIA_MANDATE_REGISTRAR"));
        address researchAgentWallet = vm.envAddress("DEMO_RESEARCH_AGENT_WALLET");
        address opsAgentWallet = vm.envAddress("DEMO_OPS_AGENT_WALLET");
        address arcWallet = vm.envAddress("DEMO_ARC_WALLET");

        MandateRegistrar.MandateTerms memory terms = MandateRegistrar.MandateTerms({
            allowlistRoot: keccak256(abi.encodePacked(arcWallet)), // single-leaf demo allowlist
            budgetTotal: DEMO_BUDGET_TOTAL,
            perTxCap: DEMO_PER_TX_CAP,
            expiry: uint64(block.timestamp) + DEMO_DURATION,
            budgetPeriod: DEMO_BUDGET_PERIOD,
            maxDepth: DEMO_MAX_DEPTH
        });

        vm.startBroadcast();

        (bytes32 researchNode,) = registrar.issueMandate(
            "research", researchAgentWallet, terms, arcWallet, "[{\"target\":\"demo\"}]"
        );
        (bytes32 opsNode,) = registrar.issueMandate(
            "ops", opsAgentWallet, terms, arcWallet, "[{\"target\":\"demo\"}]"
        );

        vm.stopBroadcast();

        console2.log("Issued research mandate, node:", vm.toString(researchNode));
        console2.log("Issued ops mandate, node:", vm.toString(opsNode));
        console2.log("Now run the Enforcer to mirror these onto Arc - see enforcer/README.md.");
    }
}
