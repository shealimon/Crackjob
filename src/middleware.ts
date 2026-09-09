import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionTokenCookieName } from "@/lib/session-cookie";

function safeCallbackUrl(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

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

/** Try both cookie variants (Secure / non-Secure) so AUTH_URL mismatches don't bounce users. */
async function readSessionToken(req: NextRequest) {
  const secret = process.env.AUTH_SECRET?.trim().replace(/^["']|["']$/g, "");
  for (const secureCookie of [true, false] as const) {
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
  const token = await readSessionToken(req);
  const isLoggedIn = Boolean(token);
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/auth/desktop");

  // Already signed in — skip login/signup UI entirely (no flash).
  if (isLoggedIn && isAuthPage) {
    const dest = safeCallbackUrl(req.nextUrl.searchParams.get("callbackUrl"));
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin));
  }

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
