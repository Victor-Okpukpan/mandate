"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { sepolia, arcTestnet } from "viem/chains";
import { formatUnits } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { MockERC20Abi } from "@mandate/shared/abis";
import { fromErc20Usdc } from "@mandate/shared/decimals";
import { getPublicSepoliaAddresses } from "@/lib/publicNetworkAddresses";

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io/address";
const ARC_EXPLORER = "https://testnet.arcscan.app/address";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * What replaced the old "click the address to log out" button. That wasn't just unpolished — it
 * was a real footgun: the one thing most wallet UIs never let a single click do by accident is
 * disconnect. This is the ordinary dropdown pattern (RainbowKit/ConnectKit-style) instead: opening
 * the menu and disconnecting are two different, differently-styled targets, and the menu itself
 * answers the four things a connected wallet should always be able to answer without leaving the
 * page — my address, my balance, which network that balance is on, and where to look it up myself.
 */
export function WalletMenu() {
  const { user, logout } = usePrivy();
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const sepoliaAddrs = getPublicSepoliaAddresses();

  const { data: sepoliaEth } = useBalance({ address, chainId: sepolia.id, query: { enabled: open } });
  const { data: sepoliaUsdc } = useReadContract({
    address: sepoliaAddrs.mockUsdc,
    abi: MockERC20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: open && Boolean(address) },
  });
  const { data: arcNative } = useBalance({ address, chainId: arcTestnet.id, query: { enabled: open } });

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!address) return null;

  async function handleCopy() {
    await navigator.clipboard.writeText(address!);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const label = user?.email?.address ?? truncate(address);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-[13px] text-secondary transition-colors hover:border-border-strong hover:text-primary"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-live" aria-hidden />
        {label}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border-subtle bg-surface shadow-lg">
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
            <span className="font-mono text-[13px] text-primary" title={address}>
              {truncate(address)}
            </span>
            <button
              onClick={handleCopy}
              className="rounded px-1.5 py-0.5 font-mono text-[11px] text-tertiary transition-colors hover:bg-surface-2 hover:text-primary"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="flex flex-col gap-3 px-4 py-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-label text-tertiary">Sepolia · authority</span>
                <a
                  href={`${SEPOLIA_EXPLORER}/${address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-accent hover:underline"
                >
                  View →
                </a>
              </div>
              <p className="mt-1 font-mono text-[13px] tnum text-primary">
                {sepoliaEth ? Number(formatUnits(sepoliaEth.value, sepoliaEth.decimals)).toFixed(4) : "…"} ETH
                <span className="ml-2 text-secondary">
                  {sepoliaUsdc !== undefined ? fromErc20Usdc(sepoliaUsdc as bigint) : "…"} USDC
                </span>
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-label text-tertiary">Arc testnet · money</span>
                <a
                  href={`${ARC_EXPLORER}/${address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-accent hover:underline"
                >
                  View →
                </a>
              </div>
              <p className="mt-1 font-mono text-[13px] tnum text-primary">
                {arcNative ? Number(formatUnits(arcNative.value, arcNative.decimals)).toFixed(4) : "…"} USDC
              </p>
            </div>
          </div>

          <div className="border-t border-border-subtle p-2">
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full rounded-md px-3 py-2 text-left text-[13px] text-revoked transition-colors hover:bg-revoked-subtle"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
