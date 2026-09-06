/**
 * Hand-written ABI fragment for ENSv2 Sepolia's `ETHRegistrar` — mirrors
 * `contracts/src/interfaces/IETHRegistrar.sol` exactly, whose signatures are resolved from the
 * deployed bytecode's selector table (see that file's NatSpec), not the ENS docs. Only the
 * functions the onboarding wizard actually calls: availability/price checks are read-only and
 * `commit`/`register` are called through `MandateOrgFactory`, never directly against this
 * contract, so this fragment stays deliberately small.
 */
export const ETHRegistrarAbi = [
  {
    type: "function",
    name: "isAvailable",
    stateMutability: "view",
    inputs: [{ name: "label", type: "string" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "MIN_COMMITMENT_AGE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "MAX_COMMITMENT_AGE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getRegisterPrice",
    stateMutability: "view",
    inputs: [
      { name: "label", type: "string" },
      { name: "duration", type: "uint64" },
      { name: "paymentToken", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
