"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@mandate/ui/components/Theme";
import { LogoMark, Wordmark } from "@mandate/ui/components/Logo";
import { ConnectButton } from "./ConnectButton";

const ROUTES = [
  { href: "/", label: "Mandates" },
  { href: "/mandate/new", label: "Issue mandate" },
  { href: "/jobs", label: "Jobs" },
  { href: "/treasury", label: "Treasury" },
];

const ORG_NAME = process.env.NEXT_PUBLIC_ORG_ENS_NAME ?? "mandate.eth";

/**
 * Persistent left rail + content — the dashboard shell every route mounts inside. Network status
 * dots at the bottom aren't decorative: this app spans two chains (Sepolia for authority, Arc for
 * money) and a reader should never have to guess which one a given number came from.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border-subtle bg-surface max-lg:hidden">
        <div className="flex h-16 items-center gap-2.5 border-b border-border-subtle px-5">
          <LogoMark className="h-5 w-5 shrink-0" />
          <span className="font-mono text-[13px] font-medium tracking-tight text-primary">
            {ORG_NAME}
          </span>
          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-live animate-pulse-live" aria-hidden />
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {ROUTES.map((r) => {
            const active = r.href === "/" ? pathname === "/" : pathname.startsWith(r.href);
            return (
              <Link
                key={r.href}
                href={r.href}
                className={`rounded-md px-3 py-2 text-[13.5px] transition-colors ${
                  active
                    ? "bg-surface-2 font-medium text-primary"
                    : "text-secondary hover:bg-surface-2 hover:text-primary"
                }`}
              >
                {r.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-2 border-t border-border-subtle p-4">
          <div className="flex items-center justify-between text-[11px] text-tertiary">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-live" aria-hidden />
              Sepolia · authority
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-tertiary">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              Arc testnet · money
            </span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col border-b border-border-subtle bg-base/80 backdrop-blur-md lg:hidden">
          <div className="flex h-16 items-center justify-between gap-4 px-6">
            <Link href="/">
              <Wordmark />
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <ConnectButton />
            </div>
          </div>
          <nav className="mask-fade-x flex items-center gap-1 overflow-x-auto px-4 pb-3">
            {ROUTES.map((r) => {
              const active = r.href === "/" ? pathname === "/" : pathname.startsWith(r.href);
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                    active
                      ? "bg-surface-2 font-medium text-primary"
                      : "text-secondary hover:bg-surface-2 hover:text-primary"
                  }`}
                >
                  {r.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <div className="hidden items-center justify-end gap-3 border-b border-border-subtle px-6 py-3 lg:flex">
          <ThemeToggle />
          <ConnectButton />
        </div>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
