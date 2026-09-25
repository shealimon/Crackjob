"use client";

import { useDashboardData } from "@/components/dashboard/dashboard-data";
import { DashboardShell } from "@/components/dashboard/shell";

export type DashboardBootstrapUser = {
  name: string | null;
  email: string | null;
};

/** Shell chrome from JWT first; plan label fills in after /api/me. */
export function DashboardFrame({
  bootstrapUser,
  children,
}: {
  bootstrapUser: DashboardBootstrapUser;
  children: React.ReactNode;
}) {
  const { data } = useDashboardData();
  const user = data
    ? {
        name: data.user.name,
        email: data.user.email,
        planLabel: data.user.planLabel,
        fullAccess: data.user.fullAccess,
      }
    : {
        name: bootstrapUser.name,
        email: bootstrapUser.email,
        planLabel: "Loading…",
        fullAccess: false,
      };

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
