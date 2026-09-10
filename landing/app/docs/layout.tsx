import Link from "next/link";
import { Nav } from "../_components/Nav";
import { Footer } from "../_components/Footer";

const SECTIONS = [
  { href: "/docs", label: "Overview" },
  { href: "/docs/architecture", label: "Architecture" },
  { href: "/docs/ens", label: "ENS" },
  { href: "/docs/privy", label: "Privy" },
  { href: "/docs/arc", label: "Arc" },
  { href: "/docs/security", label: "Security" },
  { href: "/docs/roadmap", label: "Roadmap" },
  { href: "/docs/demo", label: "Demo" },
];

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <div className="mx-auto flex max-w-6xl gap-10 px-6 py-12">
        <aside className="hidden w-44 shrink-0 sm:block">
          <nav className="sticky top-24 flex flex-col gap-1">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-md px-3 py-1.5 text-[13px] text-secondary transition-colors hover:bg-surface-2 hover:text-primary"
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1 pb-20">{children}</main>
      </div>
      <Footer />
    </>
  );
}
