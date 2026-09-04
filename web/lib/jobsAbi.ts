/**
 * Minimal hand-written ABI fragment for Arc's ERC-8183 reference Jobs contract (`AgenticCommerce`)
 * — verified selectors only (SPONSOR-NOTES), not the full `getJob` return shape, which wasn't
 * independently confirmed field-by-field. Kept deliberately small rather than guessing a struct
 * layout this page would silently mis-render.
 */
export const JobsAbi = [
  {
    type: "function",
    name: "jobCounter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
