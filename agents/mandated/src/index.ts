import Anthropic from "@anthropic-ai/sdk";
import { PrivyClient } from "@privy-io/node";
import { getRpcUrls } from "@mandate/shared/addresses";
import { makeChainClients, makeDevSigner, makePrivySigner, runMandatedAgent } from "@mandate/agents-shared";
import { ROLE_PROMPTS, type AgentRole } from "./roles.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

async function main() {
  const role = requireEnv("AGENT_ROLE") as AgentRole;
  if (!(role in ROLE_PROMPTS)) {
    throw new Error(`AGENT_ROLE must be one of: ${Object.keys(ROLE_PROMPTS).join(", ")}`);
  }
  const ensName = requireEnv("AGENT_ENS_NAME");
  const task = requireEnv("AGENT_TASK");

  const anthropic = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  const clients = makeChainClients();

  const devKey = process.env.AGENT_DEV_PRIVATE_KEY_ANVIL_ONLY;
  const signer = devKey
    ? makeDevSigner(devKey as `0x${string}`, getRpcUrls())
    : makePrivySigner(
        // @privy-io/node's PrivyClient has no constructor-level authorization-key option —
        // matches enforcer/src/index.ts's own construction. See that file's comment on why
        // dropping PRIVY_AUTHORIZATION_PRIVATE_KEY here regresses nothing (it was always empty).
        new PrivyClient({ appId: requireEnv("PRIVY_APP_ID"), appSecret: requireEnv("PRIVY_APP_SECRET") }),
        requireEnv("AGENT_PRIVY_WALLET_ID"),
        requireEnv("AGENT_ARC_WALLET_ADDRESS") as `0x${string}`,
        clients.arc,
      );

  console.log(`[${ensName}] starting as ${role}, signing from ${signer.address}`);

  await runMandatedAgent(
    anthropic,
    {
      ensName,
      clients,
      signer,
      systemPrompt: ROLE_PROMPTS[role],
    },
    task,
  );
}

main().catch((err) => {
  console.error("[agent] fatal:", err);
  process.exit(1);
});
