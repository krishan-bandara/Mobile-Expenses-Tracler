import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Supabase's magic link actually lands. The email link points here
 * with ?code=... — this exchanges that code for a real session (setting
 * the auth cookies) and only then sends the user into the app. Without
 * this route, the code arrives and is simply never used, so no session
 * ever gets created and middleware bounces the user straight back to
 * /login — which is exactly the loop this fixes.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
