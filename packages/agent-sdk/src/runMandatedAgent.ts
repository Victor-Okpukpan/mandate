import Anthropic from "@anthropic-ai/sdk";
import { buildMandatedAgentTools, type ToolContext } from "./tools.js";

export interface MandatedAgentConfig extends ToolContext {
  /** The agent's ROLE and how it should behave — never its budget or limits. Those come from
   *  `read_my_mandate()`, live, every time; hardcoding them here would be exactly the "told its
   *  budget" failure mode mandate.md warns against. */
  systemPrompt: string;
  model?: string;
  maxTurns?: number;
}

/**
 * Runs one mandated agent to completion on a single task, using the SDK's Tool Runner
 * (`client.beta.messages.toolRunner` — camelCase in the actual SDK, not the snake_case
 * `tool_runner` an earlier planning note assumed) rather than the batteries-included Claude Agent
 * SDK: a mandated agent should be structurally unable to shell out or reach around its own
 * mandate, and the Tool Runner exposes only the tools explicitly defined here. The adversarial
 * agent (`agents/adversary`) is the deliberate exception — see its own README.
 */
export async function runMandatedAgent(
  client: Anthropic,
  config: MandatedAgentConfig,
  userMessage: string,
) {
  const tools = buildMandatedAgentTools(config);

  const runner = client.beta.messages.toolRunner({
    model: config.model ?? "claude-haiku-4-5",
    max_tokens: 2048,
    system: config.systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools,
  });

  let turns = 0;
  const maxTurns = config.maxTurns ?? 20;
  let finalMessage: Anthropic.Beta.Messages.BetaMessage | undefined;

  for await (const message of runner) {
    finalMessage = message;
    turns += 1;
    for (const block of message.content) {
      if (block.type === "text") console.log(`[${config.ensName}] ${block.text}`);
      if (block.type === "tool_use") console.log(`[${config.ensName}] → ${block.name}(${JSON.stringify(block.input)})`);
    }
    if (turns >= maxTurns) {
      console.warn(`[${config.ensName}] hit maxTurns (${maxTurns}) — stopping`);
      break;
    }
  }

  return finalMessage;
}
