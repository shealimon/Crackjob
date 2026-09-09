import { DashboardShell } from "@/components/dashboard/shell";
import { getDashboardShell } from "@/lib/dashboard-data";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getDashboardShell();

  return (
    <DashboardShell
      user={{
        name: data.user.name,
        email: data.user.email,
        planLabel: data.user.planLabel,
        fullAccess: data.user.fullAccess,
      }}
    >
      {children}
    </DashboardShell>
  );
}
