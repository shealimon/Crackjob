import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authEmailCallbackUrl } from "@/lib/app-url";
import { createSupabaseRouteClient } from "@/lib/supabase/route";

const schema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
});

export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const jar = NextResponse.next();
  const { supabase, applyCookies } = createSupabaseRouteClient(req, jar);
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: body.data.email,
    options: {
      emailRedirectTo: authEmailCallbackUrl("/login?verified=1"),
    },
  });

  if (error) {
    console.error("supabase resend verification", error);
  }

  return applyCookies(
    NextResponse.json({
      ok: true,
      message:
        "If your account still needs verification, you'll receive a new email shortly.",
    }),
  );
}
