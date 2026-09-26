import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refreshes the Supabase auth session on every request (required by
 * @supabase/ssr) and redirects to /login when there is no session.
 * The PIN/biometric app-lock is a separate, client-side gate (see
 * src/lib/auth/pinLock.ts + src/app/lock) — it runs after this, once
 * we already know the request is authenticated.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  // A stale refresh-token cookie (left over from an account that was
  // just deleted, or whose email just changed via the dashboard) makes
  // getUser() come back with an AuthApiError rather than throwing —
  // but it also leaves that same dead cookie sitting in the browser,
  // which would otherwise get resent and fail the same way on every
  // single request. signOut() here clears it properly through the
  // same cookie adapter set up above, instead of the error just
  // repeating in the logs forever until it's cleared by hand.
  if (error) {
    await supabase.auth.signOut();
  }

  const publicPaths = ["/login", "/auth"];
  const isPublic = publicPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if ((!user || error) && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"]
};
