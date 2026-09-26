export const THEME_KEY = "expense-tracker:theme";

export type Theme = "light" | "dark";

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Runs synchronously in <head>, before the page paints — this is what
 * prevents a flash of the wrong theme on load. It has to be a plain
 * inline script rather than a useEffect: an effect only runs after
 * React has already rendered (and the browser has already painted)
 * the default light theme once, so anyone with dark mode saved would
 * see a flash of light before it corrected itself.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    var theme = stored === 'dark' || stored === 'light'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;
