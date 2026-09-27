"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";

/**
 * A sun/moon toggle. Reads the real theme from the DOM on mount (the
 * inline script in layout.tsx already set the .dark class before this
 * component ever renders) rather than assuming light, so the icon
 * itself never flashes to the wrong state either.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  // Render nothing until mounted rather than guessing — avoids a
  // mismatch between server-rendered markup and the client's actual
  // saved preference.
  if (theme === null) {
    return <div className="w-11 h-11 rounded-2xl bg-card shrink-0 shadow-[0_2px_8px_rgba(20,20,31,0.05)]" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className="w-11 h-11 rounded-2xl bg-card flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(20,20,31,0.05)]"
    >
      {theme === "dark" ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}
    </button>
  );
}
