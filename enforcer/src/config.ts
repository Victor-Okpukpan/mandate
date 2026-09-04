import { Wallet } from "ethers";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { readFileSync } from "node:fs";
import {
  getArcAddresses,
  getSepoliaAddresses,
  getRpcUrls,
} from "@mandate/shared/addresses";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

/**
 * The Enforcer's signing key — the one that authorizes every `MandateAnchor.syncMandate` and
 * `heartbeat` call. Loaded from an encrypted V3 keystore JSON file, password supplied separately,
 * never a raw private key in `.env`. The sole carve-out (per contracts/README.md's own convention)
 * is a plaintext key explicitly marked as an Anvil/local-testnet throwaway, gated behind its own
 * env var so it can never be reached by accident.
 */
export function loadEnforcerAccount(): PrivateKeyAccount {
  const devKey = process.env.ENFORCER_DEV_PRIVATE_KEY_ANVIL_ONLY;
  if (devKey) {
    console.warn(
      "⚠️  Using ENFORCER_DEV_PRIVATE_KEY_ANVIL_ONLY — a plaintext key. Local/Anvil use only, never testnet or mainnet.",
    );
    return privateKeyToAccount(devKey as `0x${string}`);
  }

  const keystorePath = requireEnv("ENFORCER_KEYSTORE_PATH");
  const password = requireEnv("ENFORCER_KEYSTORE_PASSWORD");
  const json = readFileSync(keystorePath, "utf-8");
  const wallet = Wallet.fromEncryptedJsonSync(json, password);
  return privateKeyToAccount(wallet.privateKey as `0x${string}`);
}

export function loadPrivyCredentials() {
  return {
    appId: requireEnv("PRIVY_APP_ID"),
    appSecret: requireEnv("PRIVY_APP_SECRET"),
    // Only required if the org's Privy app has a registered authorization keypair (key-quorum
    // signer-routed calls) — Privy's `privy-authorization-signature` header, per SPONSOR-NOTES
    // §4.5. Optional: a simpler Privy app setup works without it.
    authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY,
  };
}

export function loadDeployedAddresses() {
  const sepolia = getSepoliaAddresses();
  const arc = getArcAddresses();
  if (!sepolia.mandateRegistrar) {
    throw new Error("SEPOLIA_MANDATE_REGISTRAR not set — nothing to watch yet.");
  }
  if (!arc.mandateAnchor) {
    throw new Error("ARC_MANDATE_ANCHOR not set — nowhere to sync to yet.");
  }
  return {
    mandateRegistrar: sepolia.mandateRegistrar,
    mandateAnchor: arc.mandateAnchor,
    rpc: getRpcUrls(),
  };
}

/** Seconds an anchor may go unsynced before `assertSpend` fails closed — mirrors the value
 *  `MandateAnchor` was deployed with. The heartbeat loop fires at a third of this. */
export const MAX_STALENESS_SECONDS = Number(process.env.ENFORCER_MAX_STALENESS_SECONDS ?? 900);
export const HEARTBEAT_INTERVAL_MS = (MAX_STALENESS_SECONDS / 3) * 1000;
