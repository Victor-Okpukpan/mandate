/**
 * Minimal hand-written ABI fragment for ENSv2's `PermissionedResolver` — an external contract we
 * compose, not one of ours (see contracts/src/interfaces/IPermissionedResolver.sol for the full
 * interface and its verification notes). Only `text()`, the one read the triptych needs.
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
] as const;
