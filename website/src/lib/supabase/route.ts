import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/anon";

export type AuthCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

/**
 * Route-handler Supabase client that records auth/PKCE cookies onto `response`
 * and returns them so callers can copy onto a different NextResponse (e.g. JSON).
 */
export function createSupabaseRouteClient(request: NextRequest, response: NextResponse) {
  const { url, anonKey } = getSupabaseEnv();
  const recorded: AuthCookie[] = [];

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          recorded.push({ name, value, options });
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  return {
    supabase,
    applyCookies(to: NextResponse) {
      recorded.forEach(({ name, value, options }) => {
        to.cookies.set(name, value, options);
      });
      return to;
    },
  };
}
