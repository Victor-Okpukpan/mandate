import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn";

/**
 * Form primitives. Both apps previously hand-rolled an `inputClass` string and a local `Field`
 * wrapper; the composer's validation went through `window.alert()`. These exist so a form field
 * looks and behaves the same everywhere, and so an invalid value has somewhere to be shown that
 * isn't a browser dialog.
 */
const CONTROL_BASE =
  "w-full rounded-lg border bg-surface px-3 text-[14px] text-primary shadow-xs " +
  "placeholder:text-disabled transition-colors duration-150 " +
  "focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export interface FieldProps {
  label: string;
  /** Mono, sits under the control. The place to explain a unit or a constraint before the user
   *  trips over it — "6-decimal USDC", "must not exceed the parent's cap". */
  hint?: ReactNode;
  /** When present, the field renders in its error register and `hint` is superseded. */
  error?: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, htmlFor, required, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-label text-tertiary"
      >
        {label}
        {required ? <span className="text-revoked">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] leading-snug text-revoked-strong">{error}</p>
      ) : hint ? (
        <p className="text-[12px] leading-snug text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Chain values (addresses, amounts, hashes) should be typed and read in mono. */
  mono?: boolean;
}

export function Input({ invalid, mono = false, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        "h-10",
        mono && "font-mono text-[13px] tnum",
        invalid ? "border-revoked/60 focus:border-revoked" : "border-border",
        className,
      )}
      {...props}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  mono?: boolean;
}

export function Textarea({ invalid, mono = false, className, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        "min-h-24 resize-y py-2.5 leading-relaxed",
        mono && "font-mono text-[13px]",
        invalid ? "border-revoked/60 focus:border-revoked" : "border-border",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  invalid,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        "h-10 cursor-pointer appearance-none pr-8",
        invalid ? "border-revoked/60" : "border-border",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
