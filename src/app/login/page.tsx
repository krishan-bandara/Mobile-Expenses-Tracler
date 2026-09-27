"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { WALLET_ILLUSTRATION_B64 } from "./illustration";

/**
 * Single-user sign-in with email + password. No email round-trip needed
 * for day-to-day sign-in — only the one-time "Create account" step sends
 * anything, and only if your Supabase project still has "Confirm email"
 * turned on (Authentication -> Sign In / Providers -> Email). Turn that
 * off for a personal single-user app and even that one email disappears.
 *
 * Illustration is the user's own uploaded asset — extracted from the
 * isolated "Object" layer of their PSD (confirmed genuine RGBA
 * transparency), not a hand-drawn approximation.
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

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
      setNotice(
        `Check ${email} to confirm your account, then sign in below.`
      );
      setMode("signin");
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #9B7CFF 0%, #7C5CFC 55%, #6142E8 100%)",
      }}
    >
      {/* Decorative background circles */}
      <div
        className="absolute rounded-full bg-white/[0.07]"
        style={{
          top: 30,
          right: -40,
          width: 160,
          height: 160,
        }}
      />

      <div
        className="absolute rounded-full bg-white/[0.05]"
        style={{
          top: 160,
          left: -55,
          width: 120,
          height: 120,
        }}
      />

      {/* Illustration */}
      <div
        className="shrink-0 pt-8 flex justify-center relative"
        style={{ height: 228 }}
      >
        <img
          src={`data:image/png;base64,${WALLET_ILLUSTRATION_B64}`}
          alt=""
          style={{
            width: 220,
            height: "auto",
          }}
        />
      </div>

      {/* App title */}
      <div className="shrink-0 px-8 pt-2 text-center">
        <h1 className="text-white font-extrabold text-[21px] tracking-tight">
          Expense Tracker
        </h1>

        <p className="text-white/80 text-[13px] mt-1.5">
          Every rupee, tracked and understood.
        </p>
      </div>

      {/* Login card */}
      <div className="flex-grow bg-card rounded-t-[28px] px-6 pt-5 pb-6 shadow-[0_-10px_30px_rgba(20,20,31,0.12)] flex flex-col">
        <h2 className="text-[17px] font-bold">Welcome back</h2>

        <p className="text-[12.5px] text-muted mt-1 mb-6">
          {mode === "signin"
            ? "Sign in with your email and password."
            : "Create your account."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          {/* Email */}
          <label className="flex items-center gap-2.5 h-12 rounded-2xl bg-surface px-3.5">
            <Mail
              size={15}
              className="text-muted shrink-0"
              strokeWidth={1.8}
            />

            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-grow min-w-0 bg-transparent outline-none text-[14px]"
            />
          </label>

          {/* Password */}
          <label className="flex items-center gap-2.5 h-12 rounded-2xl bg-surface px-3.5">
            <Lock
              size={15}
              className="text-muted shrink-0"
              strokeWidth={1.8}
            />

            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-grow min-w-0 bg-transparent outline-none text-[14px]"
            />
          </label>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="h-[46px] rounded-2xl text-white font-bold text-[15px] mt-1 disabled:opacity-50 shadow-[0_8px_18px_rgba(124,92,252,0.3)]"
            style={{
              background:
                "linear-gradient(135deg, #9B7CFF, #7C5CFC)",
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>

          {/* Success / information message */}
          {notice && (
            <p className="text-sm text-good-fg text-center mt-1">
              {notice}
            </p>
          )}

          {/* Error message */}
          {error && (
            <p className="text-sm text-bad-fg text-center mt-1">
              {error}
            </p>
          )}
        </form>

        {/* Sign in / Sign up switch */}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="w-full text-center text-[12.5px] text-muted mt-3"
        >
          {mode === "signin" ? (
            <>
              First time here?{" "}
              <span className="text-primary font-bold">
                Create an account
              </span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <span className="text-primary font-bold">
                Sign in
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}