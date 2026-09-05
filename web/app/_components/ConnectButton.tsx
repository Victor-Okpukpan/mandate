"use client";

import { usePrivy } from "@privy-io/react-auth";

function ConnectButtonInner() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return <div className="h-8 w-24 animate-pulse-live rounded-md bg-surface-3" />;
  }

  if (authenticated) {
    const label = user?.email?.address ?? user?.wallet?.address?.slice(0, 10) ?? "connected";
    return (
      <button
        onClick={() => logout()}
        className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-3 text-[13px] text-secondary transition-colors hover:border-border-strong hover:text-primary"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-live" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={() => login()}
      className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
    >
      Sign in
    </button>
  );
}

/** Renders a static chip instead of touching `usePrivy()` when auth isn't configured — calling
 *  Privy's hooks with no provider mounted throws, not just renders emptily. */
export function ConnectButton() {
  const privyConfigured = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  if (!privyConfigured) {
    return (
      <span className="rounded-md border border-dashed border-border-strong px-3 py-1.5 font-mono text-[11px] text-tertiary">
        auth not configured
      </span>
    );
  }
  return <ConnectButtonInner />;
}
