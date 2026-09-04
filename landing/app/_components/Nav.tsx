import Link from "next/link";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.runmandate.xyz";
const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/victor-okpukpan/mandate";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-base/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 font-mono text-[15px] font-medium tracking-tight">
          <span className="h-1.5 w-1.5 rounded-full bg-live animate-pulse-live" aria-hidden />
          MANDATE
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-secondary sm:flex">
          <Link href="/docs" className="hover:text-primary transition-colors">
            Docs
          </Link>
          <Link href="/docs/architecture" className="hover:text-primary transition-colors">
            Architecture
          </Link>
          <a href={REPO_URL} className="hover:text-primary transition-colors" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
        <a
          href={APP_URL}
          className="inline-flex h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-strong"
        >
          Launch app →
        </a>
      </div>
    </header>
  );
}
