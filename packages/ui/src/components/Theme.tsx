"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export type Theme = "light" | "dark";
const STORAGE_KEY = "mandate-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Dark is the committed default everywhere (see tokens.css) — this provider only persists an
 * explicit user choice, it never reads prefers-color-scheme. `defaultTheme` should match whatever
 * the server rendered on <html> (via the inline script in InitTheme) so hydration doesn't flash.
 */
export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: {
  children: ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") setThemeState(stored);
    } catch {
      // Storage can throw in a locked-down browser context — dark default stands.
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal — the toggle still works for the rest of the session.
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

/**
 * Inline, un-hydrated script — sets `data-theme` on <html> before first paint by reading
 * localStorage directly. Render this once at the very top of <body> in each app's root layout.
 * Without it, the ThemeProvider's effect only runs after hydration and a returning light-mode
 * visitor sees one dark frame first. Dark needs no attribute at all — the bare :root in
 * tokens.css already is the dark palette — so this only ever has to write "light".
 */
export function InitTheme() {
  const script = `(function(){try{var t=window.localStorage.getItem(${JSON.stringify(
    STORAGE_KEY,
  )});if(t==="light")document.documentElement.setAttribute("data-theme","light");}catch(e){}})();`;
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-tertiary",
        "transition-colors duration-150 hover:border-border-strong hover:text-primary",
        className,
      )}
    >
      {isDark ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"
          />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            fill="currentColor"
            d="M20.7 14.9a8.6 8.6 0 0 1-10.6-10.6A9 9 0 1 0 20.7 14.9Z"
          />
        </svg>
      )}
    </button>
  );
}
