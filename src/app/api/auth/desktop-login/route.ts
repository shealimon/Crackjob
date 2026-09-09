import { z } from "zod";
import { loginSchema } from "@/lib/auth-credentials";
import { createDesktopSession, userPublicPayload } from "@/lib/desktop-session";
import { json, optionsCors } from "@/lib/http";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { syncPrismaUserFromSupabase } from "@/lib/supabase/sync-user";

const schema = loginSchema.extend({
  deviceId: z.string().min(4).max(120).optional(),
  platform: z.string().max(40).optional(),
});

export function OPTIONS() {
  return optionsCors();
}

export async function POST(request: Request) {
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return json({ error: "Enter a valid email and password" }, { status: 400 });
  }

  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.data.email,
    password: body.data.password,
  });

  if (error || !data.user) {
    const msg = error?.message?.toLowerCase() ?? "";
    if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
      return json(
        {
          error: "Verify your email before signing in. Check your inbox for the Supabase link.",
          code: "email_not_verified",
        },
        { status: 403 },
      );
    }
    return json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (!data.user.email_confirmed_at) {
    return json(
      {
        error: "Verify your email before signing in. Check your inbox for the Supabase link.",
        code: "email_not_verified",
      },
      { status: 403 },
    );
  }

  const user = await syncPrismaUserFromSupabase(data.user);

  const [{ token }, profile] = await Promise.all([
    createDesktopSession({
      userId: user.id,
      deviceId: body.data.deviceId,
      platform: body.data.platform || "Windows",
    }),
    userPublicPayload(user.id),
  ]);

  return json({ token, user: profile });
}
