"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@mandate/ui/components/Theme";
import { LogoMark, Wordmark } from "@mandate/ui/components/Logo";
import { ConnectButton } from "./ConnectButton";

/**
 * Persistent left rail + content — the dashboard shell every route mounts inside. Nav is derived
 * from the URL, not a fixed list: `/` and `/onboard` have no org yet, so they get a minimal shell
 * (logo + directory link); `/org/[orgEnsName]/...` gets the full org-scoped nav, built relative to
 * that org's own base path so two orgs never share a highlighted-tab bug. Network status dots
 * aren't decorative: this app spans two chains (Sepolia for authority, Arc for money) and a reader
 * should never have to guess which one a given number came from.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const orgMatch = pathname.match(/^\/org\/([^/]+)/);
  const orgSlug = orgMatch?.[1];
  const orgEnsName = orgSlug ? decodeURIComponent(orgSlug) : null;
  const base = orgSlug ? `/org/${orgSlug}` : null;

  const routes = base
    ? [
        { href: base, label: "Mandates" },
        { href: `${base}/mandate/new`, label: "Issue mandate" },
        { href: `${base}/jobs`, label: "Jobs" },
        { href: `${base}/treasury`, label: "Treasury" },
      ]
    : [{ href: "/", label: "Organisations" }];

  function isActive(href: string) {
    return href === base || href === "/" ? pathname === href : pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border-subtle bg-surface max-lg:hidden">
        <div className="flex h-16 items-center gap-2.5 border-b border-border-subtle px-5">
          <LogoMark className="h-5 w-5 shrink-0" />
          {orgEnsName ? (
            <>
              <span className="truncate font-mono text-[13px] font-medium tracking-tight text-primary">
                {orgEnsName}
              </span>
              <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-live animate-pulse-live" aria-hidden />
            </>
          ) : (
            <span className="font-mono text-[13px] font-medium tracking-tight text-primary">MANDATE</span>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {routes.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className={`rounded-md px-3 py-2 text-[13.5px] transition-colors ${
                isActive(r.href)
                  ? "bg-surface-2 font-medium text-primary"
                  : "text-secondary hover:bg-surface-2 hover:text-primary"
              }`}
            >
              {r.label}
            </Link>
          ))}
          {base ? (
            <Link
              href="/"
              className="mt-1 rounded-md px-3 py-2 text-[12px] text-tertiary transition-colors hover:bg-surface-2 hover:text-secondary"
            >
              ← All organisations
            </Link>
          ) : null}
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
            {routes.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                  isActive(r.href)
                    ? "bg-surface-2 font-medium text-primary"
                    : "text-secondary hover:bg-surface-2 hover:text-primary"
                }`}
              >
                {r.label}
              </Link>
            ))}
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
