"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";

export function AccountChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");

  if (isDashboard) {
    return <>{children}</>;
  }

  return (
    <div className="marketing-dark auth-shell relative flex min-h-dvh flex-1 flex-col">
      <div className="relative z-10 flex min-h-dvh flex-1 flex-col">
        <AppHeader />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
