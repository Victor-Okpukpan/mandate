/**
 * Optional adapter for Anthropic's Tool Runner — for anyone already on Claude who wants the tool
 * schema written for them, instead of calling `connectMandate()`'s plain methods directly. Not the
 * core of this package; the root export (`mandate-agent-sdk`) has zero LLM dependency and works
 * with any framework.
 */
export * from "./tools.js";
export * from "./runMandatedAgent.js";
