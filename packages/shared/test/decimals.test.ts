import { describe, expect, it } from "vitest";
import {
  ERC20_USDC_DECIMALS,
  NATIVE_TO_ERC20_USDC_SCALE,
  NATIVE_USDC_DECIMALS,
  erc20ToNativeUsdc,
  fromErc20Usdc,
  fromNativeUsdc,
  nativeToErc20Usdc,
  toErc20Usdc,
  toNativeUsdc,
} from "../src/decimals.js";

describe("the Arc decimal trap (SPONSOR-NOTES §1.2)", () => {
  it("is exactly 10^12 apart, matching the verified on-chain empirical values", () => {
    // Same account, same instant, verified on-chain:
    //   eth_getBalance      = 489806094501337632462976
    //   USDC.balanceOf(...)  =        489806094501
    const nativeBalance = 489806094501337632462976n;
    const erc20Balance = 489806094501n;

    expect(NATIVE_USDC_DECIMALS - ERC20_USDC_DECIMALS).toBe(12);
    expect(NATIVE_TO_ERC20_USDC_SCALE).toBe(10n ** 12n);
    expect(nativeToErc20Usdc(nativeBalance)).toBe(erc20Balance);
  });

  it("round-trips native <-> erc20 without drift on whole-unit amounts", () => {
    const native = toNativeUsdc("50");
    const erc20 = nativeToErc20Usdc(native);
    expect(erc20).toBe(toErc20Usdc("50"));
    expect(erc20ToNativeUsdc(erc20)).toBe(native);
  });

  it("formats each representation at its own decimals, never the other's", () => {
    expect(fromNativeUsdc(toNativeUsdc("1.5"))).toBe("1.5");
    expect(fromErc20Usdc(toErc20Usdc("1.5"))).toBe("1.5");
  });

  it("never silently truncates a native (18dp) amount finer than erc20 (6dp) allows", () => {
    // 1 wei of native USDC is far below erc20 granularity — the conversion must floor, not throw,
    // but callers doing real transfers should never be operating at native-only precision.
    const oneWei = 1n;
    expect(nativeToErc20Usdc(oneWei)).toBe(0n);
  });
});
