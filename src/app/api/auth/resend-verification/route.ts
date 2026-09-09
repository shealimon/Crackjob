import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { appBaseUrl } from "@/lib/app-url";

const schema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
});

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const supabase = createSupabaseAnonClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: body.data.email,
    options: {
      emailRedirectTo: `${appBaseUrl()}/auth/callback?next=${encodeURIComponent("/login?verified=1")}`,
    },
  });

  if (error) {
    console.error("supabase resend verification", error);
  }

  return NextResponse.json({
    ok: true,
    message:
      "If your account still needs verification, you'll receive a new email shortly.",
  });
}
