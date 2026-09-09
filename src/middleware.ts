import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionTokenCookieName } from "@/lib/session-cookie";

function safeCallbackUrl(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

/** Try both cookie variants (Secure / non-Secure) so AUTH_URL mismatches don't bounce users. */
async function readSessionToken(req: NextRequest) {
  const secret = process.env.AUTH_SECRET;
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
    "/dashboard/:path*",
    "/auth/desktop/:path*",
    "/login",
    "/signup",
  ],
};
