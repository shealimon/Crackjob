import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionTokenCookieName } from "@/lib/session-cookie";
import { SITE_URL } from "@/lib/seo";

const LEGACY_HOSTS = new Set(["porpin.com", "www.porpin.com", "www.crackjob.co"]);

function canonicalHostRedirect(req: NextRequest): NextResponse | null {
  const host = req.nextUrl.host.toLowerCase();
  if (/localhost|127\.0\.0\.1/i.test(host) || host.endsWith(".vercel.app")) {
    return null;
  }
  try {
    const canonical = new URL(SITE_URL);
    const want = canonical.host.toLowerCase();
    if (!want || host === want) return null;
    if (!LEGACY_HOSTS.has(host) && host !== `www.${want}`) return null;
    const url = req.nextUrl.clone();
    url.protocol = canonical.protocol;
    url.host = want;
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
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/auth/desktop");

  // Login/signup stay in the matcher so legacy hosts still redirect, but the
  // JWT is unused there. Decoding it only delays the form. Those pages check
  // the cookie themselves and hit the DB only when a session is present.
  if (!isProtected) {
    return NextResponse.next();
  }

  const token = await readSessionToken(req);
  const isLoggedIn = Boolean(token);

  if (!isLoggedIn && isProtected) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  // Only auth-gated pages. A broad matcher + Next 16 Turbopack "proxy" makes
  // unrelated routes (/, /api/auth/session, …) return HTML 404s in dev.
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/auth/desktop",
    "/auth/desktop/:path*",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ],
};
