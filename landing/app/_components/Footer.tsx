import Link from "next/link";
import { Eyebrow } from "@mandate/ui/components/Type";
import { Wordmark } from "@mandate/ui/components/Logo";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/victor-okpukpan/mandate";

const DOCS_LINKS = [
  { href: "/docs/architecture", label: "Architecture" },
  { href: "/docs/ens", label: "ENS" },
  { href: "/docs/privy", label: "Privy" },
  { href: "/docs/arc", label: "Arc" },
  { href: "/docs/security", label: "Security" },
  { href: "/docs/demo", label: "Demo" },
];

export function Footer() {
  return (
    <footer className="border-t border-border-subtle">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <Wordmark />
            <p className="mt-3 font-sans text-[17px] leading-snug text-secondary">
              ENS subnames are revocable powers of attorney for AI agents. Arc is where they spend.
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <Eyebrow>Docs</Eyebrow>
            {DOCS_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-[14px] text-secondary transition-colors hover:text-primary">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            <Eyebrow>Project</Eyebrow>
            <a href={REPO_URL} className="text-[14px] text-secondary transition-colors hover:text-primary" target="_blank" rel="noreferrer">
              Source (GitHub)
            </a>
            <a href={`${REPO_URL}/blob/main/LICENSE`} className="text-[14px] text-secondary transition-colors hover:text-primary" target="_blank" rel="noreferrer">
              MIT License
            </a>
          </div>
        </div>
        <div className="mt-12 border-t border-border-subtle pt-6 font-mono text-[11px] text-disabled">
          Built for ETHOnline 2026 · Every address is loaded from configuration, never hard-coded.
        </div>
      </div>
    </footer>
  );
}
