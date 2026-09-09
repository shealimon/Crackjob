import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return { url, anonKey };
}

const globalForSupabase = globalThis as unknown as {
  __crackSupabaseAnon?: SupabaseClient;
};

/** Server-side anon client (Auth signup/login/reset). SMTP is configured in Supabase. */
export function createSupabaseAnonClient() {
  if (globalForSupabase.__crackSupabaseAnon) {
    return globalForSupabase.__crackSupabaseAnon;
  }
  const { url, anonKey } = getSupabaseEnv();
  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  globalForSupabase.__crackSupabaseAnon = client;
  return client;
}
