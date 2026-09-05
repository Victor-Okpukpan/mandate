import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "../lib/cn";

/**
 * Table primitives. With charts off the table, tabular data IS the product's visualisation layer,
 * so it gets the care a chart would otherwise absorb: mono uppercase headers, hairline row rules,
 * tabular figures, and a horizontal scroll container so a wide table never forces the page to
 * scroll sideways.
 */
export function TableWrap({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("-mx-2 overflow-x-auto px-2", className)} {...props}>
      {children}
    </div>
  );
}

export function Table({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn("w-full min-w-[42rem] border-collapse text-left", className)} {...props}>
      {children}
    </table>
  );
}

export function Th({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-border-subtle pb-2.5 pr-4 font-mono text-[11px] font-normal uppercase tracking-label text-tertiary",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("border-b border-border-subtle py-3 pr-4 align-middle text-[14px]", className)}
      {...props}
    >
      {children}
    </td>
  );
}

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Rows that open a drawer get a pointer, a hover wash, and keyboard focus. */
  interactive?: boolean;
  selected?: boolean;
}

export function Tr({ interactive, selected, className, children, ...props }: TrProps) {
  return (
    <tr
      className={cn(
        "transition-colors duration-150",
        interactive && "cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2",
        selected && "bg-accent-subtle/60",
        className,
      )}
      {...(interactive ? { tabIndex: 0, role: "button" } : {})}
      {...props}
    >
      {children}
    </tr>
  );
}
