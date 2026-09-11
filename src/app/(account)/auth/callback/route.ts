import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { syncPrismaUserFromSupabase } from "@/lib/supabase/sync-user";

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/login?verified=1";
  }
  return raw;
}

/**
 * Handles Supabase email confirmation redirects:
 * - `?code=` (PKCE) after ConfirmationURL
 * - `?token_hash=&type=` when the Auth email template uses {{ .TokenHash }}
 *
 * On success, syncs Prisma `User.emailVerified` from `email_confirmed_at`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  const redirect = NextResponse.redirect(new URL(next, origin));
  const { supabase, applyCookies } = createSupabaseRouteClient(request, redirect);

  let user = null;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) user = data.user;
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error && data.user) user = data.user;
  }

  if (user) {
    await syncPrismaUserFromSupabase(user);
  }

  return applyCookies(redirect);
}
