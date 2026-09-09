"use client";

import { DashboardDataProvider, useDashboardData } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/shell";

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const { data } = useDashboardData();
  const user = data?.user;

  return (
    <DashboardShell
      user={{
        name: user?.name ?? null,
        email: user?.email ?? null,
        planLabel: user?.planLabel ?? "…",
        fullAccess: user?.fullAccess ?? false,
      }}
    >
      {children}
    </DashboardShell>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardDataProvider initial={null}>
      <DashboardChrome>{children}</DashboardChrome>
    </DashboardDataProvider>
  );
}
