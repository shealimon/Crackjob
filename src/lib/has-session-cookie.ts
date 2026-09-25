import { cookies } from "next/headers";
import { sessionTokenCookieName } from "@/lib/session-cookie";

const SESSION_COOKIE_NAMES = [
  sessionTokenCookieName(true),
  sessionTokenCookieName(false),
];

/** True when an Auth.js session cookie (or a chunk of one) is present. */
export function sessionCookiePresent(
  cookieNames: Iterable<string>,
): boolean {
  for (const name of cookieNames) {
    for (const base of SESSION_COOKIE_NAMES) {
      if (name === base || name.startsWith(`${base}.`)) return true;
    }
  }
  return false;
}

/**
 * Logged-out login/signup can render without auth() or Prisma.
 * A present cookie still needs the DB check — it can outlive a deleted user.
 */
export async function hasSessionCookie(): Promise<boolean> {
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (!cookie.value) continue;
    if (sessionCookiePresent([cookie.name])) return true;
  }
  return false;
}
