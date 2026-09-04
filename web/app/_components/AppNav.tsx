"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

const ROUTES = [
  { href: "/", label: "Graph" },
  { href: "/mandate/new", label: "New mandate" },
  { href: "/jobs", label: "Jobs" },
  { href: "/treasury", label: "Treasury" },
];

function ConnectButton() {
  const privyConfigured = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  if (!privyConfigured) {
    return (
      <span className="rounded-md border border-border-strong px-3 py-1.5 font-mono text-[11px] text-tertiary">
        auth not configured
      </span>
    );
  }
  return <ConnectButtonInner />;
}

function ConnectButtonInner() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return <div className="h-8 w-24 animate-pulse rounded-md bg-surface-2" />;
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

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-base/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-mono text-[15px] font-medium tracking-tight">
            <span className="h-1.5 w-1.5 rounded-full bg-live animate-pulse-live" aria-hidden />
            MANDATE
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {ROUTES.map((r) => {
              const active = r.href === "/" ? pathname === "/" : pathname.startsWith(r.href);
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                    active ? "bg-surface-2 text-primary" : "text-secondary hover:text-primary"
                  }`}
                >
                  {r.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
