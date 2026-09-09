/** Shared Auth.js session cookie naming — must match login encode salt + middleware + auth(). */

export function useSecureAuthCookies(req?: Request): boolean {
  // On Vercel / production always use Secure cookies (ignore localhost AUTH_URL).
  if (process.env.VERCEL === "1") return true;
  if (process.env.NODE_ENV === "production") return true;

  const authUrl = process.env.AUTH_URL?.trim() ?? "";
  if (authUrl.startsWith("https://")) return true;
  if (authUrl.startsWith("http://")) return false;

  const proto = req?.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]?.trim() === "https";
  return false;
}

export function sessionTokenCookieName(secure: boolean) {
  return secure ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export function sessionTokenCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
  };
}
