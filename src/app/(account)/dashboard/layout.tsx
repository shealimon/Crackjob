import type { Metadata } from "next";
import { DashboardDataProvider } from "@/components/dashboard/dashboard-data";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { DashboardNavProvider } from "@/components/dashboard/nav";
import { DashboardShell } from "@/components/dashboard/shell";
import { getDashboardShell } from "@/lib/dashboard-data";

/** Private account area — keep out of Google index. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await getDashboardShell();
  const initial = {
    user: shell.user,
    usageByDay: [] as { date: string; creditsUsed: number }[],
    desktopSession: shell.desktopSession,
  };

  return (
    <DashboardDataProvider initial={initial}>
      <DashboardNavProvider>
        <DashboardShell
          user={{
            name: shell.user.name,
            email: shell.user.email,
            planLabel: shell.user.planLabel,
            fullAccess: shell.user.fullAccess,
          }}
        >
          {/* Client-switched panels — instant menu nav; route pages stay for deep links. */}
          <DashboardView />
        </DashboardShell>
      </DashboardNavProvider>
      {/* Register App Router segments without blocking the shell UI. */}
      <div className="hidden" aria-hidden>
        {children}
      </div>
    </DashboardDataProvider>
  );
}
