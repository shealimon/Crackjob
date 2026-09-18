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

  return (
    <ToastProvider>
      {withSession ? (
        <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
          {children}
        </SessionProvider>
      ) : (
        children
      )}
    </ToastProvider>
  );
}
