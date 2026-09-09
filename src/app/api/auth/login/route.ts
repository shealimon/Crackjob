import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/auth-credentials";
import { prisma } from "@/lib/prisma";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { syncPrismaUserFromSupabase } from "@/lib/supabase/sync-user";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days (Auth.js default)

function useSecureCookies(req: Request) {
  const authUrl = process.env.AUTH_URL?.trim();
  if (authUrl?.startsWith("https://")) return true;
  if (authUrl?.startsWith("http://")) return false;
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]?.trim() === "https";
  return new URL(req.url).protocol === "https:";
}

function metaName(authUser: { user_metadata?: Record<string, unknown> }) {
  return typeof authUser.user_metadata?.name === "string"
    ? authUser.user_metadata.name
    : null;
}

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

  const authUser = data.user;
  const email = authUser.email!.toLowerCase();
  const name = metaName(authUser);
  const secure = useSecureCookies(req);
  const cookieName = secure ? "__Secure-authjs.session-token" : "authjs.session-token";

  // Overlap Prisma lookup with JWT encode (same id for normal users).
  const [existing, encoded] = await Promise.all([
    prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, email: true, name: true },
    }),
    encode({
      token: {
        id: authUser.id,
        sub: authUser.id,
        email,
        name,
        picture: null,
      },
      secret,
      salt: cookieName,
      maxAge: SESSION_MAX_AGE,
    }),
  ]);

  let sessionToken = encoded;
  if (!existing) {
    const user = await syncPrismaUserFromSupabase(authUser);
    if (user.id !== authUser.id) {
      sessionToken = await encode({
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
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
