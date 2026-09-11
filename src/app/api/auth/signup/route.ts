import { NextRequest, NextResponse } from "next/server";
import { signupSchema } from "@/lib/auth-credentials";
import { authEmailCallbackUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { syncPrismaUserFromSupabase } from "@/lib/supabase/sync-user";

const EMAIL_EXISTS_MSG =
  "An account with this email already exists. Sign in instead.";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid signup details";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { email, password, name } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: EMAIL_EXISTS_MSG }, { status: 409 });
  }

  const jar = NextResponse.next();
  const { supabase, applyCookies } = createSupabaseRouteClient(req, jar);
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: { name },
      emailRedirectTo: authEmailCallbackUrl("/login?verified=1"),
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return NextResponse.json({ error: EMAIL_EXISTS_MSG }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Supabase often returns 200 with an empty identities list when the email is taken
  // (instead of an error) to avoid leaking whether the address is registered.
  const identities = data.user?.identities ?? [];
  if (data.user && identities.length === 0) {
    return NextResponse.json({ error: EMAIL_EXISTS_MSG }, { status: 409 });
  }

  if (data.user) {
    await syncPrismaUserFromSupabase(data.user, { name });
  }

  const needsVerification = !data.session;
  return applyCookies(
    NextResponse.json(
      {
        ok: true,
        needsVerification,
        message: needsVerification
          ? "Check your email for the Supabase verification link before signing in."
          : "Account created. You can sign in now.",
      },
      { status: 201 },
    ),
  );
}
