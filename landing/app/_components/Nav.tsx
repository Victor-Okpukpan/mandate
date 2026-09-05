import Link from "next/link";
import { ThemeToggle } from "@mandate/ui/components/Theme";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.runmandate.xyz";
const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/victor-okpukpan/mandate";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-base/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-mono text-[14px] font-medium tracking-tight text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-live animate-pulse-live" aria-hidden />
          MANDATE
        </Link>
        <nav className="hidden items-center gap-7 text-[14px] text-secondary sm:flex">
          <Link href="/docs" className="transition-colors hover:text-primary">
            Docs
          </Link>
          <Link href="/docs/architecture" className="transition-colors hover:text-primary">
            Architecture
          </Link>
          <a href={REPO_URL} className="transition-colors hover:text-primary" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <a
            href={APP_URL}
            className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-[13.5px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
          >
            Launch app →
          </a>
        </div>
      </div>
    </header>
  );
}
