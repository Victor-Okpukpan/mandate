"use client";

import { usePrivy } from "@privy-io/react-auth";
import { WalletMenu } from "./WalletMenu";

function ConnectButtonInner() {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return <div className="h-8 w-24 animate-pulse-live rounded-md bg-surface-3" />;
  }

  if (authenticated) {
    return <WalletMenu />;
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
