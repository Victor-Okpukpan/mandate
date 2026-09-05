import Anthropic from "@anthropic-ai/sdk";
import { PrivyClient } from "@privy-io/server-auth";
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
        // Matches the Enforcer's own PrivyClient construction (enforcer/src/index.ts) — if the
        // org's Privy app has a registered authorization keypair, wallet RPC calls fail without
        // this, per the SDK's own docstring. Omitting it here while the Enforcer passed it was
        // the actual repo state before this fix; harmless for an app with no authorization key,
        // silently broken for one that has it.
        new PrivyClient(requireEnv("PRIVY_APP_ID"), requireEnv("PRIVY_APP_SECRET"), {
          walletApi: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY
            ? { authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY }
            : undefined,
        }),
        requireEnv("AGENT_PRIVY_WALLET_ID"),
        requireEnv("AGENT_ARC_WALLET_ADDRESS") as `0x${string}`,
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
