"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

/**
 * Browser-side Supabase client. Safe to import from client components —
 * only ever uses the public anon key.
 *
 * Guarded against server-side execution: Next.js still performs one
 * render pass over "use client" pages at build/request time to produce
 * the initial HTML/RSC shell, even for pages marked force-dynamic. If a
 * page calls this synchronously at the top of its component body (most
 * do, for convenience), that render pass would otherwise try to
 * construct a real Supabase client on the server — where env vars may
 * not even be relevant — and @supabase/ssr throws hard if they're
 * missing or blank. Every real call site in this app only ever *uses*
 * the returned client inside useEffect/handlers, which never run
 * during SSR, so returning a harmless stub here during SSR is safe.
 */
export function createClient() {
  if (typeof window === "undefined") {
    return null as unknown as ReturnType<typeof createBrowserClient<Database>>;
  }
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
