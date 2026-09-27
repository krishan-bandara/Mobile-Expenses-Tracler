"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isUnlocked } from "@/lib/auth/pinLock";

const INACTIVITY_LIMIT_MS = 12 * 60 * 1000;
const ACTIVITY_KEY = "expense-tracker:last-activity";

function markActivity() {
  try {
    sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {
    // sessionStorage can throw in some private-browsing modes — fine
    // to just skip tracking rather than crash the page over it.
  }
}

function msSinceLastActivity(): number {
  try {
    const v = sessionStorage.getItem(ACTIVITY_KEY);
    return v ? Date.now() - Number(v) : 0;
  } catch {
    return 0;
  }
}

/**
 * Drop this at the top of any authenticated page. Handles two
 * separate things:
 *
 * 1. PIN lock — if a PIN is set on the account and this session
 * hasn't been unlocked yet, bounce to /lock before anything sensitive
 * renders. Checks Supabase directly on every mount rather than
 * trusting a flag saved in this browser's local storage — that was
 * the actual bug behind the lock seeming to "reset": local storage is
 * per browser, so setting a PIN on one device left every *other*
 * device with no record a PIN existed at all, and they'd walk
 * straight past the lock. Supabase is the one source of truth now, on
 * every device, exactly as it should be.
 *
 * 2. Inactivity auto-logout — 12 minutes with no click, keypress,
 * touch, or scroll signs the session out entirely (not just back to
 * the PIN lock) on both web and mobile, since this one component runs
 * on every page either way. Activity is tracked in sessionStorage
 * rather than component state so it survives page navigation, and
 * checked both on a timer and immediately when the tab regains focus
 * — the latter matters because a backgrounded tab's timers get
 * throttled by the browser, so without it a long-backgrounded tab
 * might not actually sign out until well after the 12 minutes are up.
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

  useEffect(() => {
    if (pathname === "/login") return;
    markActivity(); // arriving on a page counts as activity too

    const events: (keyof WindowEventMap)[] = ["click", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));

    async function checkInactivity() {
      if (msSinceLastActivity() < INACTIVITY_LIMIT_MS) return;
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.auth.signOut();
      router.replace("/login");
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void checkInactivity();
    }

    const interval = setInterval(checkInactivity, 20_000);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActivity));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, [pathname, router]);

  return null;
}
