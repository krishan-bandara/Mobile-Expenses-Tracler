"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isUnlocked } from "@/lib/auth/pinLock";

/**
 * Drop this at the top of any authenticated page. If a PIN has been set
 * up (checked by the /lock page itself against the profile) and the
 * session hasn't been unlocked yet, bounce to /lock before anything
 * sensitive renders. Harmless — and skipped — if no PIN was ever set.
 */
export function LockCheck() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/lock" || pathname === "/login") return;
    const pinWasSetUp = typeof window !== "undefined" && localStorage.getItem("expense-tracker:pin-enabled") === "1";
    if (pinWasSetUp && !isUnlocked()) {
      router.replace(`/lock?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router]);

  return null;
}
