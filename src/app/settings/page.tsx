"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Fingerprint, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { LockCheck } from "@/components/LockCheck";
import { PinPad } from "@/components/PinPad";
import { hashPin, randomSalt, biometricSupported, registerBiometric } from "@/lib/auth/pinLock";
import type { Profile } from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settingPin, setSettingPin] = useState(false);
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | undefined>();
  const [canBiometric, setCanBiometric] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data as Profile);
      setCanBiometric(await biometricSupported());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePinStep(pin: string) {
    if (!firstPin) {
      setFirstPin(pin);
      return;
    }
    if (pin !== firstPin) {
      setPinError("PINs didn't match — start again.");
      setFirstPin(null);
      return;
    }
    if (!userId) return;
    const salt = randomSalt();
    const hash = await hashPin(pin, salt);
    await supabase.from("profiles").update({ pin_hash: hash, pin_salt: salt }).eq("id", userId);
    setSettingPin(false);
    setFirstPin(null);
    setPinError(undefined);
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data as Profile);
  }

  async function enableBiometric() {
    if (!userId) return;
    const ok = await registerBiometric(userId);
    if (ok) {
      await supabase.from("profiles").update({ biometric_enabled: true }).eq("id", userId);
      setProfile((p) => (p ? { ...p, biometric_enabled: true } : p));
    }
  }

  async function removePin() {
    if (!userId) return;
    if (!confirm("Turn off the app lock? Anyone who picks up this device will be able to open the ledger.")) {
      return;
    }
    await supabase.from("profiles").update({ pin_hash: null, pin_salt: null, biometric_enabled: false }).eq("id", userId);
    setProfile((p) => (p ? { ...p, pin_hash: null, biometric_enabled: false } : p));
  }

  async function signOut() {
    if (!confirm("Sign out?")) return;
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (settingPin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-card flex items-center justify-center">
            <Lock size={24} />
          </div>
          <h1 className="text-lg font-bold mt-2">{firstPin ? "Confirm your PIN" : "Choose a 4-digit PIN"}</h1>
        </div>
        <PinPad onComplete={handlePinStep} error={pinError} />
        <button type="button" onClick={() => { setSettingPin(false); setFirstPin(null); }} className="text-sm text-muted">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <>
      <LockCheck />
      <div className="px-[18px] pt-[18px] pb-1">
        <h1 className="text-[26px] font-extrabold tracking-tight">Settings</h1>
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 px-4">
        <SettingsLink href="/categories" label="Categories" />
        <SettingsLink href="/accounts" label="Accounts" />
        <SettingsLink href="/recurring" label="Recurring items" />
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 px-4">
        <div className="flex items-center gap-3 h-14 border-b border-border">
          <Lock size={18} className="text-muted shrink-0" />
          <span className="flex-grow text-[15px]">App lock</span>
          {profile?.pin_hash ? (
            <button type="button" onClick={removePin} className="text-sm text-bad-fg font-semibold">
              Turn off
            </button>
          ) : (
            <button type="button" onClick={() => setSettingPin(true)} className="text-sm text-primary font-semibold">
              Set up
            </button>
          )}
        </div>
        {profile?.pin_hash && canBiometric && (
          <div className="flex items-center gap-3 h-14">
            <Fingerprint size={18} className="text-muted shrink-0" />
            <span className="flex-grow text-[15px]">Fingerprint / Face unlock</span>
            {profile.biometric_enabled ? (
              <span className="text-sm text-good-fg font-semibold">On</span>
            ) : (
              <button type="button" onClick={enableBiometric} className="text-sm text-primary font-semibold">
                Turn on
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 px-4">
        <button type="button" onClick={signOut} className="w-full text-left h-14 text-[15px] font-semibold text-bad-fg">
          Sign out
        </button>
      </div>

      <div className="flex-grow" />
      <div className="pt-3" />
      <BottomNav />
    </>
  );
}

function SettingsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 h-14 border-b border-border last:border-b-0">
      <span className="flex-grow text-[15px]">{label}</span>
      <ChevronRight size={18} className="text-muted" />
    </Link>
  );
}
