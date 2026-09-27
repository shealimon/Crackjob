"use client";

import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/toast";

/** Auth.js client session — not needed on dashboard (shell uses JWT + /api/me). */
function needsAuthSession(pathname: string) {
  return (
    pathname.startsWith("/auth/") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email"
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const withSession = needsAuthSession(pathname);
  // Login/signup forms don't read the client session. Passing null skips the
  // /api/auth/session request that otherwise races the first paint.
  const knownSignedOut = pathname === "/login" || pathname === "/signup";

  return (
    <ToastProvider>
      {withSession ? (
        <SessionProvider
          session={knownSignedOut ? null : undefined}
          refetchOnWindowFocus={false}
          refetchInterval={0}
        >
          {children}
        </SessionProvider>
      ) : (
        children
      )}
    </ToastProvider>
  );
}
