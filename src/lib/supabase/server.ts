import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Server-side Supabase client for Server Components, Route Handlers and
 * Server Actions. Reads the session from cookies via @supabase/ssr.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no response to write to.
            // Safe to ignore when middleware is refreshing the session.
          }
        }
      }
    }
  );
}

/**
 * Service-role client for trusted, admin-only server work that needs to
 * bypass RLS on purpose. Nothing in this app currently calls it — the
 * scan-bill route uses the regular authenticated client instead, since
 * the storage RLS policy already covers that case. Kept here for future
 * use (e.g. an export/backup script). Requires SUPABASE_SERVICE_ROLE_KEY
 * to be set; never import this from a file that could end up in a
 * client bundle.
 */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local if you need admin-only access."
    );
  }
  return createRawClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false }
  });
}
