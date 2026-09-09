import { DashboardDataProvider } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/shell";
import { getDashboardShell } from "@/lib/dashboard-data";

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
      <DashboardShell
        user={{
          name: shell.user.name,
          email: shell.user.email,
          planLabel: shell.user.planLabel,
          fullAccess: shell.user.fullAccess,
        }}
      >
        {children}
      </DashboardShell>
    </DashboardDataProvider>
  );
}
