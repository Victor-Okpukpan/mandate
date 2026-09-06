import Link from "next/link";
import { ThemeToggle } from "@mandate/ui/components/Theme";
import { Wordmark } from "@mandate/ui/components/Logo";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.runmandate.xyz";

/**
 * Docs is the one nav link, on purpose — Architecture and GitHub used to sit next to it as
 * separate items, but Architecture is itself a page inside /docs (a link to a link), and GitHub
 * is one click further into /docs from there. Two redundant paths to the same content, cut.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-base/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/">
            <Wordmark />
          </Link>
          <Link
            href="/docs"
            className="hidden text-[14px] font-medium text-primary transition-colors hover:text-accent sm:block"
          >
            Docs
          </Link>
        </div>
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
