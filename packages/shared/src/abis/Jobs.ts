/**
 * Hand-written ABI fragment for Arc's ERC-8183 reference Jobs contract (`AgenticCommerce`) —
 * verified selectors only (SPONSOR-NOTES §1.5), not the full `getJob` return shape, which wasn't
 * independently confirmed field-by-field. Kept deliberately small rather than guessing a struct
 * layout a consumer would silently mis-render or mis-encode.
 */
export const JobsAbi = [
  {
    type: "function",
    name: "jobCounter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createJob",
    stateMutability: "nonpayable",
    inputs: [
      { name: "provider", type: "address" },
      { name: "evaluator", type: "address" },
      { name: "expiredAt", type: "uint256" },
      { name: "description", type: "string" },
      { name: "hook", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "submit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jobId", type: "uint256" },
      { name: "deliverable", type: "bytes32" },
      { name: "optParams", type: "bytes" },
    ],
    outputs: [],
  },
] as const;
