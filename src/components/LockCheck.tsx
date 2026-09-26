"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isUnlocked } from "@/lib/auth/pinLock";

/**
 * Drop this at the top of any authenticated page. If a PIN is set on
 * the account and this session hasn't been unlocked yet, bounce to
 * /lock before anything sensitive renders.
 *
 * This checks Supabase directly on every mount rather than trusting a
 * flag saved in this browser's local storage — that was the actual
 * bug behind the lock seeming to "reset": local storage is per
 * browser, so setting a PIN on one device left every *other* device
 * with no record a PIN existed at all, and they'd walk straight past
 * the lock. Supabase is the one source of truth now, on every device,
 * exactly as it should be.
 */
export function LockCheck() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/lock" || pathname === "/login") return;
    if (isUnlocked()) return;

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: profile } = await supabase.from("profiles").select("pin_hash").eq("id", user.id).single();
      if (cancelled) return;

      if (profile?.pin_hash) {
        router.replace(`/lock?next=${encodeURIComponent(pathname)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return null;
}
