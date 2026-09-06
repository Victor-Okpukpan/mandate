/**
 * Multi-org directory, built entirely from `MandateOrgFactory.OrgCreated` (Sepolia) and
 * `ArcVaultFactory.VaultCreated` (Arc) logs — no indexer, matching this stack's own philosophy
 * (see `web/lib/useMandateGraph.ts`). An org's existence and its vault's existence are two
 * independent on-chain facts on two different chains; `joinOrgVaults` is the only place that ever
 * treats them as one thing, and it does so by `orgRootNode` — an ASSERTION `ArcVaultFactory`
 * accepts at `createVault` time, not a verified cross-chain link. See `ArcVaultFactory`'s own
 * NatSpec on why the real safety property is owner-equality, checked by the Enforcer, not by
 * anything here.
 */
import type { Address, Hex, PublicClient } from "viem";
import { MandateOrgFactoryAbi, ArcVaultFactoryAbi } from "./abis";

export interface Org {
  registrar: Address;
  orgRootRegistry: Address;
  admin: Address;
  orgRootNode: Hex;
  orgEnsName: string;
  createdAtBlock: bigint;
}

export interface Vault {
  anchor: Address;
  treasury: Address;
  admin: Address;
  enforcer: Address;
  orgRootNode: Hex;
  createdAtBlock: bigint;
}

export interface OrgWithVault extends Org {
  vault?: Vault;
}

/** Every org a `MandateOrgFactory` has ever created, oldest first. */
export async function listOrgs(
  client: PublicClient,
  factory: Address,
  fromBlock: bigint | "earliest" = "earliest",
): Promise<Org[]> {
  const logs = await client.getContractEvents({
    address: factory,
    abi: MandateOrgFactoryAbi,
    eventName: "OrgCreated",
    fromBlock,
    toBlock: "latest",
  });

  return logs
    .map((log) => ({
      registrar: log.args.registrar!,
      orgRootRegistry: log.args.orgRootRegistry!,
      admin: log.args.admin!,
      orgRootNode: log.args.orgRootNode!,
      orgEnsName: log.args.orgEnsName!,
      createdAtBlock: log.blockNumber,
    }))
    .sort((a, b) => (a.createdAtBlock < b.createdAtBlock ? -1 : 1));
}

/** Every vault an `ArcVaultFactory` has ever created, oldest first. */
export async function listVaults(
  client: PublicClient,
  factory: Address,
  fromBlock: bigint | "earliest" = "earliest",
): Promise<Vault[]> {
  const logs = await client.getContractEvents({
    address: factory,
    abi: ArcVaultFactoryAbi,
    eventName: "VaultCreated",
    fromBlock,
    toBlock: "latest",
  });

  return logs
    .map((log) => ({
      anchor: log.args.anchor!,
      treasury: log.args.treasury!,
      admin: log.args.admin!,
      enforcer: log.args.enforcer!,
      orgRootNode: log.args.orgRootNode!,
      createdAtBlock: log.blockNumber,
    }))
    .sort((a, b) => (a.createdAtBlock < b.createdAtBlock ? -1 : 1));
}

/**
 * Joins orgs to vaults by `orgRootNode`. A vault created with `createVault` (not
 * `createVaultFor`) tags itself with the zero node and never joins here — that's the honest
 * outcome for a vault the wizard hasn't linked to a Sepolia org yet, not a bug to hide.
 */
export function joinOrgVaults(orgs: Org[], vaults: Vault[]): OrgWithVault[] {
  const vaultByNode = new Map<Hex, Vault>();
  for (const vault of vaults) {
    if (vault.orgRootNode !== ZERO_NODE) vaultByNode.set(vault.orgRootNode, vault);
  }
  return orgs.map((org) => ({ ...org, vault: vaultByNode.get(org.orgRootNode) }));
}

const ZERO_NODE: Hex = `0x${"0".repeat(64)}`;
