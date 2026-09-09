import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncPrismaUserFromSupabase } from "@/lib/supabase/sync-user";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/login?verified=1";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await syncPrismaUserFromSupabase(data.user);
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
