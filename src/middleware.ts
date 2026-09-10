import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionTokenCookieName } from "@/lib/session-cookie";

function canonicalHostRedirect(req: NextRequest): NextResponse | null {
  const raw = process.env.AUTH_URL?.trim();
  if (!raw || /localhost|127\.0\.0\.1/i.test(raw)) return null;
  try {
    const canonical = new URL(raw);
    const host = req.nextUrl.host.toLowerCase();
    const want = canonical.host.toLowerCase();
    if (!want || host === want) return null;
    // Don't force custom domain onto preview/deployment URLs.
    if (host.endsWith(".vercel.app")) return null;
    const url = req.nextUrl.clone();
    url.protocol = canonical.protocol;
    url.host = canonical.host;
    return NextResponse.redirect(url, 308);
  } catch {
    return null;
  }
}

/** Prefer the cookie variant this deploy actually sets; fall back once for AUTH_URL mismatches. */
async function readSessionToken(req: NextRequest) {
  const secret = process.env.AUTH_SECRET?.trim().replace(/^["']|["']$/g, "");
  const preferSecure =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const order = preferSecure ? ([true, false] as const) : ([false, true] as const);
  // On Vercel only the Secure cookie exists — skip the empty non-Secure decode.
  const variants =
    process.env.VERCEL === "1" ? ([true] as const) : order;

  for (const secureCookie of variants) {
    const cookieName = sessionTokenCookieName(secureCookie);
    const token = await getToken({
      req,
      secret,
      secureCookie,
      cookieName,
      salt: cookieName,
    });
    if (token) return token;
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const canonical = canonicalHostRedirect(req);
  if (canonical) return canonical;

  const { pathname, search } = req.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/auth/desktop");

  // Marketing + API routes don't need a JWT decode on every request.
  if (!isAuthPage && !isProtected) {
    return NextResponse.next();
  }

  const token = await readSessionToken(req);
  const isLoggedIn = Boolean(token);

  // Do NOT auto-skip /login|/signup based on JWT alone — the cookie can outlive
  // a deleted DB user. Login/signup pages verify the user still exists, then
  // either go to dashboard or clear the stale session and stay on the form.

  if (!isLoggedIn && isProtected) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
