import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Every value here is a CSS variable (defined in globals.css
        // for :root and overridden under .dark) rather than a fixed
        // hex. That's what lets a component just write `bg-card` once
        // and have it correctly switch between light and dark — no
        // component needs its own `dark:` variant for these.
        bg: "var(--color-bg)",
        card: "var(--color-card)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        primary: "var(--color-primary)",
        primaryDark: "var(--color-primary-dark)",
        primaryLight: "var(--color-primary-light)",
        border: "var(--color-border)",
        surface: "var(--color-surface)",
        surfaceStrong: "var(--color-surface-strong)",
        track: "var(--color-track)",
        accentSoft: "var(--color-accent-soft)",
        good: { bg: "var(--color-good-bg)", fg: "var(--color-good-fg)" },
        bad: { bg: "var(--color-bad-bg)", fg: "var(--color-bad-fg)" }
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"]
      },
      borderRadius: {
        xl2: "22px",
        xl3: "26px"
      }
    }
  },
  plugins: []
};

export default config;
