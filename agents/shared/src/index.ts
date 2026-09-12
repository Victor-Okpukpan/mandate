// Everything here now lives in `packages/agent-sdk` (the standalone SDK). Re-exported so nothing
// in this repo's own agent runtimes has to change its import path — `./tools.js` and
// `./runMandatedAgent.js` still exist as subpath shims for anyone importing them directly, but the
// barrel export reads from the SDK once, not through both, to avoid re-exporting the same symbols
// twice.
export * from "mandate-agent-sdk";
export * from "mandate-agent-sdk/anthropic";
