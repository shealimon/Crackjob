import { signOut } from "@/auth";

/** Drop the Auth.js session cookie without navigating away. */
export async function clearStaleSession() {
  await signOut({ redirect: false });
}

/**
 * JWT/cookie still present but DB user is gone (or session unusable).
 * Clear the session and open login silently — no error toast.
 */
export async function clearSessionToLogin(): Promise<never> {
  await signOut({ redirectTo: "/login" });
  throw new Error("unreachable");
}
