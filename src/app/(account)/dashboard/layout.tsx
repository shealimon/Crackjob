import type { Metadata } from "next";
import { auth } from "@/auth";
import { DashboardDataProvider } from "@/components/dashboard/dashboard-data";
import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { clearSessionToLogin } from "@/lib/clear-session-login";
import { noIndexMetadata } from "@/lib/seo";

/** Private account area — keep out of Google index. */
export const metadata: Metadata = noIndexMetadata;

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
  const user = session?.user;
  if (!user?.id?.trim()) {
    return clearSessionToLogin();
  }

  const bootstrapUser = {
    name: user.name ?? null,
    email: user.email ?? null,
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
