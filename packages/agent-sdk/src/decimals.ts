// Vendored from packages/shared/src/decimals.ts — duplicated, not imported, so this published
// package needs nothing from this monorepo. Keep in sync by hand if the source changes.
/**
 * The Arc decimal trap (SPONSOR-NOTES §1.2): USDC on Arc is both the native gas token AND an
 * ERC-20 at the same address, with DIFFERENT decimals.
 *
 *   native balance / msg.value / gas -> 18 decimals (parseEther / formatEther)
 *   ERC-20 balanceOf/transfer/approve -> 6 decimals  (parseUnits(x, 6) / formatUnits(x, 6))
 *
 * Verified on-chain, same account, same instant:
 *   eth_getBalance      = 489806094501337632462976
 *   USDC.balanceOf(...)  =        489806094501
 * Exactly 10^12 apart. Never inline a conversion between the two — always go through the
 * named helpers below, so an accidental unit mismatch is a type-level mistake, not a silent one.
 */
import { formatEther, formatUnits, parseEther, parseUnits } from "viem";

/** ERC-20 USDC on Arc (and every other USDC deployment we touch) uses 6 decimals. */
export const ERC20_USDC_DECIMALS = 6;

/** Native Arc gas token (also "USDC" by display, but 18 decimals like any EVM native asset). */
export const NATIVE_USDC_DECIMALS = 18;

/** The exact gap between the two representations of the same underlying unit. */
export const NATIVE_TO_ERC20_USDC_SCALE = 10n ** BigInt(NATIVE_USDC_DECIMALS - ERC20_USDC_DECIMALS);

/** Parse a human-readable USDC amount (e.g. "50.5") into 18-decimal native wei, for gas/msg.value. */
export function toNativeUsdc(amount: string): bigint {
  return parseEther(amount);
}

/** Format an 18-decimal native USDC wei amount back to a human-readable string. */
export function fromNativeUsdc(wei: bigint): string {
  return formatEther(wei);
}

/** Parse a human-readable USDC amount (e.g. "50.5") into 6-decimal ERC-20 base units. */
export function toErc20Usdc(amount: string): bigint {
  return parseUnits(amount, ERC20_USDC_DECIMALS);
}

/** Format a 6-decimal ERC-20 USDC base-unit amount back to a human-readable string. */
export function fromErc20Usdc(units: bigint): string {
  return formatUnits(units, ERC20_USDC_DECIMALS);
}

/** Convert 6-decimal ERC-20 USDC base units to the equivalent 18-decimal native wei amount. */
export function erc20ToNativeUsdc(erc20Units: bigint): bigint {
  return erc20Units * NATIVE_TO_ERC20_USDC_SCALE;
}

/** Convert 18-decimal native USDC wei to the equivalent 6-decimal ERC-20 base-unit amount. */
export function nativeToErc20Usdc(nativeWei: bigint): bigint {
  return nativeWei / NATIVE_TO_ERC20_USDC_SCALE;
}
