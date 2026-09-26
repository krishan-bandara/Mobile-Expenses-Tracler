"use client";

import { useEffect, useState } from "react";

function greetingFor(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

/**
 * Computed client-side on purpose: this page is server-rendered, and
 * the server's clock is whatever timezone the container runs in (often
 * UTC) — not necessarily the same as the person actually looking at
 * their phone. A morning/evening greeting is exactly the kind of thing
 * that's wrong more often than not if computed server-side.
 */
export function Greeting() {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(greetingFor(new Date().getHours()));
  }, []);

  return <>{text ?? "This month"}</>;
}
