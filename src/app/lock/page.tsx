"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fingerprint, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PinPad } from "@/components/PinPad";
import {
  verifyPin,
  lockoutRemainingSeconds,
  recordFailedAttempt,
  resetAttempts,
  markUnlocked,
  biometricSupported,
  hasBiometricRegistered,
  unlockWithBiometric
} from "@/lib/auth/pinLock";
import type { Profile } from "@/lib/types";

export default function LockPage() {
  return (
    <Suspense fallback={null}>
      <LockPageInner />
    </Suspense>
  );
}

function LockPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next") || "/";
  // Same-origin relative paths only, so ?next= can't bounce the user to another site.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : "/";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [canBiometric, setCanBiometric] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const p = data as Profile | null;
      setProfile(p);

      if (!p?.pin_hash) {
        // No PIN configured — nothing to unlock. Send them straight in.
        markUnlocked();
        router.replace(next);
        return;
      }

      const supported = (await biometricSupported()) && hasBiometricRegistered() && p.biometric_enabled;
      setCanBiometric(supported);
      setLoading(false);

      if (supported) {
        const ok = await unlockWithBiometric();
        if (ok) {
          markUnlocked();
          router.replace(next);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePin(pin: string) {
    if (!profile?.pin_hash || !profile.pin_salt) return;
    const wait = lockoutRemainingSeconds();
    if (wait > 0) {
      setError(`Too many attempts — try again in ${wait}s.`);
      return;
    }
    const ok = await verifyPin(pin, profile.pin_salt, profile.pin_hash);
    if (ok) {
      resetAttempts();
      markUnlocked();
      router.replace(next);
    } else {
      recordFailedAttempt();
      const lockedFor = lockoutRemainingSeconds();
      setError(lockedFor > 0 ? `Too many attempts — try again in ${lockedFor}s.` : "Wrong PIN — try again.");
    }
  }

  if (loading) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-10">
      <div className="flex flex-col items-center gap-2">
        <div className="w-14 h-14 rounded-full bg-card flex items-center justify-center">
          <Lock size={24} />
        </div>
        <h1 className="text-lg font-bold mt-2">Enter your PIN</h1>
      </div>

      <PinPad onComplete={handlePin} error={error} />

      {canBiometric && (
        <button
          type="button"
          onClick={async () => {
            const ok = await unlockWithBiometric();
            if (ok) {
              markUnlocked();
              router.replace(next);
            }
          }}
          className="flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <Fingerprint size={18} />
          Use fingerprint instead
        </button>
      )}

      <button
        type="button"
        onClick={async () => {
          if (
            !confirm(
              "Forgot your PIN? Signing out doesn't touch your data — sign back in with your email and password, then set a new PIN from Settings."
            )
          ) {
            return;
          }
          const supabase = createClient();
          await supabase.auth.signOut();
          router.replace("/login");
        }}
        className="text-sm text-muted"
      >
        Forgot PIN?
      </button>
    </div>
  );
}
