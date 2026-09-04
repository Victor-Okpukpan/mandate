import Link from "next/link";

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
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <div className="font-mono text-sm font-medium">MANDATE</div>
            <p className="mt-2 text-sm text-tertiary">
              ENS subnames are revocable powers of attorney for AI agents. Arc is where they spend.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-tertiary">Docs</span>
            {DOCS_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-secondary hover:text-primary transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-tertiary">Project</span>
            <a href={REPO_URL} className="text-secondary hover:text-primary transition-colors" target="_blank" rel="noreferrer">
              Source (GitHub)
            </a>
            <a href={`${REPO_URL}/blob/main/LICENSE`} className="text-secondary hover:text-primary transition-colors" target="_blank" rel="noreferrer">
              MIT License
            </a>
          </div>
        </div>
        <div className="mt-10 border-t border-border-subtle pt-6 text-xs text-disabled">
          Built for ETHOnline 2026. Every address is loaded from configuration, never hard-coded.
        </div>
      </div>
    </footer>
  );
}
