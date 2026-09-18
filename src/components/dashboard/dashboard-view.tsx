"use client";

import { useDashboardData } from "@/components/dashboard/dashboard-data";
import { useDashboardNav } from "@/components/dashboard/nav";
import { PanelLoading } from "@/components/dashboard/panel-loading";
import { BillingPanel } from "@/components/dashboard/billing-panel";
import { OverviewPanel } from "@/components/dashboard/overview-panel";
import { QuestionsPanel } from "@/components/dashboard/questions-panel";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { UsagePanel } from "@/components/dashboard/usage-panel";

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export function DashboardView() {
  const { path } = useDashboardNav();
  const { data, loading } = useDashboardData();
  const route = normalizePath(path);

  // Own fetch — don't wait on /api/me.
  if (route === "/dashboard/questions") {
    return <QuestionsPanel />;
  }

  if (loading) {
    return <PanelLoading label="Loading dashboard…" />;
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/60">
        Could not load dashboard data. Refresh the page or sign in again.
      </div>
    );
  }

  switch (route) {
    case "/dashboard/settings":
      return <SettingsPanel initial={data} />;
    case "/dashboard/usage":
      return <UsagePanel initial={data} />;
    case "/dashboard/billing":
      return <BillingPanel initial={data} />;
    case "/dashboard":
    default:
      return <OverviewPanel initial={data} />;
  }
}
