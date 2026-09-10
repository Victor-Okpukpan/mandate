"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useSendTransaction,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { sepolia, arcTestnet } from "viem/chains";
import { formatUnits, parseUnits, type Address } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { Erc20Abi } from "@mandate/shared/abis";
import { fromErc20Usdc } from "@mandate/shared/decimals";
import { getPublicSepoliaAddresses } from "@/lib/publicNetworkAddresses";

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io/address";
const ARC_EXPLORER = "https://testnet.arcscan.app/address";
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

type Asset = "sepoliaEth" | "sepoliaUsdc" | "arcUsdc";

const ASSET_LABEL: Record<Asset, string> = {
  sepoliaEth: "Sepolia ETH",
  sepoliaUsdc: "Sepolia USDC",
  arcUsdc: "Arc USDC",
};

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * The form that opens when a balance row's "Send" is clicked — replaces the balance list inside
 * the same popover rather than a separate modal, so closing it (the back arrow) always returns to
 * a familiar place. One thing every wallet UI is expected to do that this app had no way to do at
 * all until now: move money back out.
 */
function SendForm({
  asset,
  balance,
  sepoliaAddrs,
  onBack,
}: {
  asset: Asset;
  balance: bigint | undefined;
  sepoliaAddrs: ReturnType<typeof getPublicSepoliaAddresses>;
  onBack: () => void;
}) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [txHash, setTxHash] = useState<string | undefined>();

  const { sendTransactionAsync, isPending: sendingNative } = useSendTransaction();
  const { writeContractAsync, isPending: sendingToken } = useWriteContract();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const { chainId: currentChainId } = useAccount();
  const sending = sendingNative || sendingToken || switching;

  const targetChainId = asset === "arcUsdc" ? arcTestnet.id : sepolia.id;
  const wrongChain = currentChainId !== undefined && currentChainId !== targetChainId;

  const toValid = ADDRESS_RE.test(to);
  const decimals = asset === "sepoliaUsdc" ? 6 : 18;
  let amountWei: bigint | undefined;
  try {
    amountWei = amount ? parseUnits(amount, decimals) : undefined;
  } catch {
    amountWei = undefined;
  }
  const amountValid = Boolean(amountWei && amountWei > 0n && balance !== undefined && amountWei <= balance);

  function handleMax() {
    if (balance === undefined) return;
    setAmount(formatUnits(balance, decimals));
  }

  async function handleSend() {
    if (!toValid || !amountValid || !amountWei) return;
    setError(undefined);
    setTxHash(undefined);
    try {
      // Privy's embedded connector doesn't switch networks on its own when a write targets a
      // different chain — it just rejects with "wrong chain". Do the switch here first.
      if (wrongChain) await switchChainAsync({ chainId: targetChainId });

      if (asset === "sepoliaEth" || asset === "arcUsdc") {
        const hash = await sendTransactionAsync({ to: to as Address, value: amountWei, chainId: targetChainId });
        setTxHash(hash);
      } else {
        const hash = await writeContractAsync({
          address: sepoliaAddrs.usdc,
          abi: Erc20Abi,
          functionName: "transfer",
          args: [to as Address, amountWei],
          chainId: sepolia.id,
        });
        setTxHash(hash);
      }
      setTo("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message.split("\n")[0] : String(err));
    }
  }

  return (
    <div className="px-4 py-3">
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-[12px] text-tertiary transition-colors hover:text-primary"
      >
        ← Back
      </button>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-label text-tertiary">
        Send {ASSET_LABEL[asset]}
      </p>

      <div className="flex flex-col gap-2.5">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-label text-tertiary">To</label>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            placeholder="0x…"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-[12px] text-primary placeholder:text-disabled focus:border-accent focus-visible:outline-none"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="font-mono text-[10px] uppercase tracking-label text-tertiary">Amount</label>
            <button onClick={handleMax} className="font-mono text-[10px] text-accent hover:underline">
              Max
            </button>
          </div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            inputMode="decimal"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-[12px] text-primary placeholder:text-disabled focus:border-accent focus-visible:outline-none"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!toValid || !amountValid || sending}
          className="mt-1 w-full rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:opacity-40"
        >
          {switching ? "Switching network…" : sending ? "Sending…" : wrongChain ? `Switch to ${asset === "arcUsdc" ? "Arc" : "Sepolia"} & send` : "Send"}
        </button>

        {error ? <p className="text-[11px] text-revoked">{error}</p> : null}
        {txHash ? (
          <p className="text-[11px] text-live">
            Sent —{" "}
            <a
              href={`${asset === "arcUsdc" ? ARC_EXPLORER.replace("/address", "/tx") : SEPOLIA_EXPLORER.replace("/address", "/tx")}/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              view →
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * What replaced the old "click the address to log out" button. That wasn't just unpolished — it
 * was a real footgun: the one thing most wallet UIs never let a single click do by accident is
 * disconnect. This is the ordinary dropdown pattern (RainbowKit/ConnectKit-style) instead: opening
 * the menu and disconnecting are two different, differently-styled targets, and the menu itself
 * answers what a connected wallet should always be able to answer without leaving the page — my
 * address, my balance, which network that balance is on, where to look it up myself, and — the one
 * capability missing until now — how to actually move funds back out.
 */
export function WalletMenu() {
  const { user, logout } = usePrivy();
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendAsset, setSendAsset] = useState<Asset | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const sepoliaAddrs = getPublicSepoliaAddresses();

  const { data: sepoliaEth, refetch: refetchSepoliaEth } = useBalance({
    address,
    chainId: sepolia.id,
    query: { enabled: open },
  });
  const { data: sepoliaUsdc, refetch: refetchSepoliaUsdc } = useReadContract({
    address: sepoliaAddrs.usdc,
    abi: Erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: open && Boolean(address) },
  });
  const { data: arcNative, refetch: refetchArc } = useBalance({
    address,
    chainId: arcTestnet.id,
    query: { enabled: open },
  });

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSendAsset(null);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setSendAsset(null);
      }
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

  function handleBack() {
    setSendAsset(null);
    refetchSepoliaEth();
    refetchSepoliaUsdc();
    refetchArc();
  }

  const label = user?.email?.address ?? truncate(address);

  const balanceForAsset: Record<Asset, bigint | undefined> = {
    sepoliaEth: sepoliaEth?.value,
    sepoliaUsdc: sepoliaUsdc as bigint | undefined,
    arcUsdc: arcNative?.value,
  };

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
        <div className="absolute right-0 top-full z-50 mt-2 w-84 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border-subtle bg-surface shadow-lg">
          {sendAsset ? (
            <SendForm asset={sendAsset} balance={balanceForAsset[sendAsset]} sepoliaAddrs={sepoliaAddrs} onBack={handleBack} />
          ) : (
            <>
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
                  <div className="mt-1 flex items-center justify-between">
                    <p className="font-mono text-[13px] tnum text-primary">
                      {sepoliaEth ? Number(formatUnits(sepoliaEth.value, sepoliaEth.decimals)).toFixed(4) : "…"} ETH
                    </p>
                    <button onClick={() => setSendAsset("sepoliaEth")} className="text-[11px] text-accent hover:underline">
                      Send
                    </button>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <p className="font-mono text-[13px] tnum text-secondary">
                      {sepoliaUsdc !== undefined ? fromErc20Usdc(sepoliaUsdc as bigint) : "…"} USDC
                    </p>
                    <button onClick={() => setSendAsset("sepoliaUsdc")} className="text-[11px] text-accent hover:underline">
                      Send
                    </button>
                  </div>
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
                  <div className="mt-1 flex items-center justify-between">
                    <p className="font-mono text-[13px] tnum text-primary">
                      {arcNative ? Number(formatUnits(arcNative.value, arcNative.decimals)).toFixed(4) : "…"} USDC
                    </p>
                    <button onClick={() => setSendAsset("arcUsdc")} className="text-[11px] text-accent hover:underline">
                      Send
                    </button>
                  </div>
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
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
