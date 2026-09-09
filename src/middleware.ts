import { auth } from "@/auth";
import { NextResponse } from "next/server";

function safeCallbackUrl(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth);
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
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/auth/desktop/:path*",
    "/login",
    "/signup",
  ],
};
