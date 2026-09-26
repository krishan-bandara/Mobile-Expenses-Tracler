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
      <h1 className="text-2xl font-extrabold">Expense Tracker</h1>
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
