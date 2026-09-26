"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Single-user sign-in with email + password. No email round-trip needed
 * for day-to-day sign-in — only the one-time "Create account" step sends
 * anything, and only if your Supabase project still has "Confirm email"
 * turned on (Authentication -> Sign In / Providers -> Email). Turn that
 * off for a personal single-user app and even that one email disappears.
 */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    // mode === "signup" — one-time account creation.
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      // "Confirm email" is off for this project — signed in immediately.
      router.push("/");
      router.refresh();
    } else {
      // "Confirm email" is still on — one email needed, this one time only.
      setNotice(`Check ${email} to confirm your account, then sign in below.`);
      setMode("signin");
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
      <LoginIllustration />
      <h1 className="text-2xl font-extrabold mt-6">Expense Tracker</h1>
      <p className="text-sm text-muted mt-2 mb-8">
        {mode === "signin" ? "Sign in with your email and password." : "Create your account."}
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-12 rounded-2xl bg-card px-4 text-[15px] outline-none"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-12 rounded-2xl bg-card px-4 text-[15px] outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-12 rounded-2xl bg-primary text-white font-semibold disabled:opacity-50"
        >
          {loading ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"}
        </button>

        {notice && <p className="text-sm text-good-fg">{notice}</p>}
        {error && <p className="text-sm text-bad-fg">{error}</p>}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="text-sm text-muted mt-2"
        >
          {mode === "signin" ? "First time here? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}

/**
 * A small custom illustration — a tilted card, a spending trend line,
 * and a couple of coin accents — built as plain SVG rather than a
 * fetched image, using the same category-color palette as the rest of
 * the app so it feels like part of it rather than stock art.
 */
function LoginIllustration() {
  return (
    <svg width="168" height="132" viewBox="0 0 168 132" role="img" aria-label="">
      <title>Expense Tracker illustration</title>
      <circle cx="34" cy="26" r="12" fill="#FCD34D" opacity="0.9" />
      <circle cx="146" cy="100" r="9" fill="#5EEAD4" opacity="0.9" />
      <circle cx="152" cy="30" r="6" fill="#FB7BA2" opacity="0.9" />
      <g transform="rotate(-8 84 66)">
        <rect x="24" y="38" width="120" height="76" rx="16" fill="var(--color-card)" stroke="var(--color-border)" />
        <rect x="24" y="38" width="120" height="24" rx="16" fill="var(--color-primary)" />
        <circle cx="42" cy="50" r="6" fill="#FFFFFF" opacity="0.85" />
        <rect x="56" y="46" width="36" height="8" rx="4" fill="#FFFFFF" opacity="0.6" />
        <path
          d="M40 96 L62 80 L80 90 L104 68 L124 78"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="124" cy="78" r="4.5" fill="var(--color-primary)" />
      </g>
    </svg>
  );
}
