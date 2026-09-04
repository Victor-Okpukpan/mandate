/**
 * Hand-written ABI fragment for ENSv2's `PermissionedResolver` — an external contract we compose,
 * not one of ours (see contracts/src/interfaces/IPermissionedResolver.sol for the full interface
 * and its verification notes against the deployed Sepolia bytecode). Only the functions the
 * frontend and agent runtimes actually call: `text`/`setText`.
 */
export const PermissionedResolverAbi = [
  {
    type: "function",
    name: "text",
    stateMutability: "view",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "setText",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
] as const;
