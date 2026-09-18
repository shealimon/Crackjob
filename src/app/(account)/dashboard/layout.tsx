import type { Metadata } from "next";
import { auth } from "@/auth";
import { DashboardDataProvider } from "@/components/dashboard/dashboard-data";
import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { clearSessionToLogin } from "@/lib/clear-session-login";

/** Private account area — keep out of Google index. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Fast open: JWT check only (no Prisma shell). Client shows loading, then /api/me.
 * Skips /api/auth/session on this route (SessionProvider not mounted for /dashboard).
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id?.trim();
  if (!userId) {
    return clearSessionToLogin();
  }

  const bootstrapUser = {
    name: session.user?.name ?? null,
    email: session.user?.email ?? null,
  };

  return (
    <DashboardDataProvider initial={null}>
      <DashboardFrame bootstrapUser={bootstrapUser}>
        <DashboardView />
      </DashboardFrame>
      {/* Register App Router segments without blocking the shell UI. */}
      <div className="hidden" aria-hidden>
        {children}
      </div>
    </DashboardDataProvider>
  );
}
