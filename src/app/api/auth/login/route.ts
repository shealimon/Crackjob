import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/auth-credentials";
import {
  sessionTokenCookieName,
  sessionTokenCookieOptions,
  useSecureAuthCookies,
} from "@/lib/session-cookie";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { syncPrismaUserFromSupabase } from "@/lib/supabase/sync-user";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days (Auth.js default)

/** One-shot email/password login — avoids Auth.js CSRF + callback round-trips. */
export async function POST(req: Request) {
  const body = loginSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });
  }

  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Auth is not configured" }, { status: 500 });
  }

  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.data.email,
    password: body.data.password,
  });

  if (error || !data.user) {
    const msg = error?.message?.toLowerCase() ?? "";
    if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
      return NextResponse.json({ ok: false, code: "email_not_verified" }, { status: 403 });
    }
    return NextResponse.json({ ok: false, code: "invalid" }, { status: 401 });
  }

  if (!data.user.email_confirmed_at) {
    return NextResponse.json({ ok: false, code: "email_not_verified" }, { status: 403 });
  }

  // Always sync — signup leaves emailVerified null until confirm; do not skip for existing rows.
  const user = await syncPrismaUserFromSupabase(data.user);
  const secure = useSecureAuthCookies(req);
  const cookieName = sessionTokenCookieName(secure);

  const sessionToken = await encode({
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: null,
    },
    secret,
    salt: cookieName,
    maxAge: SESSION_MAX_AGE,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, sessionToken, {
    ...sessionTokenCookieOptions(secure),
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
