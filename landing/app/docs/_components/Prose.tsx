import type { ReactNode } from "react";

/**
 * Shared docs typography — deliberate rhythm via descendant selectors rather than a generic
 * markdown-prose plugin, so headings/code/tables read as part of the same design system as the
 * rest of the site instead of a bolted-on theme.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        "max-w-2xl",
        "[&>p]:mt-4 [&>p]:text-[15px] [&>p]:leading-relaxed [&>p]:text-secondary",
        "[&>h1]:font-sans [&>h1]:text-[2rem] [&>h1]:font-semibold [&>h1]:tracking-tight [&>h1]:text-primary",
        "[&>h2]:mt-12 [&>h2]:font-sans [&>h2]:text-[1.375rem] [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:text-primary",
        "[&>h3]:mt-8 [&>h3]:text-[15px] [&>h3]:font-medium [&>h3]:text-primary",
        "[&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-primary",
        "[&_a]:text-accent [&_a]:underline [&_a]:decoration-accent/30 [&_a]:underline-offset-4 hover:[&_a]:decoration-accent",
        "[&>ul]:mt-4 [&>ul]:list-disc [&>ul]:space-y-2 [&>ul]:pl-5 [&>ul]:text-[15px] [&>ul]:text-secondary",
        "[&>ol]:mt-4 [&>ol]:list-decimal [&>ol]:space-y-2 [&>ol]:pl-5 [&>ol]:text-[15px] [&>ol]:text-secondary",
        "[&_strong]:text-primary [&_strong]:font-medium",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function DocsTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-border bg-surface-2">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium text-secondary">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border-subtle last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 align-top text-secondary">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Callout({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <div
      className={[
        "mt-6 rounded-lg border px-4 py-3 text-[13px] leading-relaxed",
        tone === "warn"
          ? "border-expiring/30 bg-expiring-subtle text-expiring-strong"
          : "border-accent/30 bg-accent-subtle text-accent-strong",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
