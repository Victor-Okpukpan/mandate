import { PrivyClient } from "@privy-io/server-auth";
import type { Address } from "viem";

/**
 * Compiles one mandate's terms into a Privy conditional policy — the fast, stateless pre-filter.
 * Per SPONSOR-NOTES §3.1b / §4.5: Privy enforces the per-tx cap and the recipient allowlist here;
 * the CUMULATIVE rolling budget is deliberately NOT enforced by Privy — its stateful aggregations
 * cap at ~10 per app, can't partition by wallet, and update their values after a request signs,
 * not before. That ledger lives on `AgentTreasury.spentAccum` instead. Two different jobs, not a
 * belt-and-suspenders duplicate: see ARCHITECTURE.md.
 *
 * Every request type/field/operator combination used here matches
 * `@privy-io/server-auth`'s own `WalletApiPolicyRuleCreateRequestType` and its condition union
 * types — verified against the installed SDK's bundled `.d.ts`, not guessed from the REST docs
 * alone.
 */

export interface MandateTermsForPolicy {
  agentTreasury: Address;
  perTxCapUsdcBaseUnits: bigint;
  allowedRecipients: Address[];
}

export async function ensurePolicyForAgent(
  privy: PrivyClient,
  mandateNode: string,
  terms: MandateTermsForPolicy,
): Promise<{ policyId: string }> {
  const policyName = `mandate-${mandateNode.slice(0, 10)}`;

  // Restrict eth_sendTransaction two ways: only TO the org's own AgentTreasury (an agent's wallet
  // has no legitimate reason to send a raw transaction anywhere else), and only for `amount`
  // values within the mandate's per-tx cap, read out of the calldata itself via the treasury's own
  // ABI — the same "ethereum_calldata + abi + lte" pattern SPONSOR-NOTES confirms Privy supports.
  const policy = await privy.walletApi.createPolicy({
    name: policyName,
    version: "1.0",
    chainType: "ethereum",
    rules: [
      {
        name: "restrict-to-treasury",
        method: "eth_sendTransaction",
        action: "ALLOW",
        conditions: [
          {
            fieldSource: "ethereum_transaction",
            field: "to",
            operator: "eq",
            value: terms.agentTreasury,
          },
        ],
      },
      {
        name: "per-tx-cap",
        method: "eth_sendTransaction",
        action: "ALLOW",
        conditions: [
          {
            fieldSource: "ethereum_calldata",
            field: "amount",
            operator: "lte",
            value: terms.perTxCapUsdcBaseUnits.toString(),
            abi: PAY_TO_ABI,
          },
        ],
      },
      {
        name: "deny-everything-else",
        method: "*",
        action: "DENY",
        conditions: [],
      },
    ],
  });

  return { policyId: policy.id };
}

/** Just enough of AgentTreasury's ABI for Privy's calldata-condition decoder to find `amount`. */
const PAY_TO_ABI = [
  {
    type: "function",
    name: "payTo",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "proof", type: "bytes32[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

/** Attach `policyId` to `walletId` as an override on the agent's own signer, per mandate.md §4.5's
 *  key-quorum mapping — the routine path the Enforcer uses on every sync, not a one-time setup. */
export async function attachPolicyToWallet(privy: PrivyClient, walletId: string, policyId: string) {
  await privy.walletApi.updateWallet({
    id: walletId,
    policyIds: [policyId],
  });
}
