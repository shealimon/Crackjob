import { NextResponse } from "next/server";
import { z } from "zod";
import { appBaseUrl } from "@/lib/app-url";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";

const schema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
});

export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }

  const supabase = createSupabaseAnonClient();
  const { error } = await supabase.auth.resetPasswordForEmail(body.data.email, {
    redirectTo: `${appBaseUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });

  if (error) {
    console.error("supabase forgot password", error);
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for this email, you'll receive a password reset link shortly.",
  });
}
