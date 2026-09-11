"use client";

import { useEffect, useRef, useState } from "react";
import { useDashboardData } from "@/components/dashboard/dashboard-data";
import { useDashboardNav } from "@/components/dashboard/nav";
import { BillingPanel } from "@/components/dashboard/billing-panel";
import { OverviewPanel } from "@/components/dashboard/overview-panel";
import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { SpendingPanel } from "@/components/dashboard/spending-panel";
import { UsagePanel } from "@/components/dashboard/usage-panel";

function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-lg bg-black/8" />
      <div className="h-4 w-72 rounded bg-black/6" />
      <div className="h-40 rounded-2xl border border-black/8 bg-white" />
      <div className="h-40 rounded-2xl border border-black/8 bg-white" />
    </div>
  );
}

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export function DashboardView() {
  const { path } = useDashboardNav();
  const { data, loading, refresh } = useDashboardData();
  const route = normalizePath(path);
  const needsUsage =
    route === "/dashboard/usage" || route === "/dashboard/spending";
  const fetchedUsage = useRef(false);
  const [usageLoading, setUsageLoading] = useState(
    () => needsUsage && Boolean(data && data.usageByDay.length === 0),
  );

  useEffect(() => {
    if (!needsUsage || !data || data.usageByDay.length > 0 || fetchedUsage.current) {
      setUsageLoading(false);
      return;
    }
    fetchedUsage.current = true;
    let cancelled = false;
    setUsageLoading(true);
    void refresh().finally(() => {
      if (!cancelled) setUsageLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [needsUsage, data, refresh]);

  if (!data) {
    if (loading) return <PanelSkeleton />;
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/60">
        Could not load dashboard data. Refresh the page or sign in again.
      </div>
    );
  }

  if (needsUsage && usageLoading && data.usageByDay.length === 0) {
    return <PanelSkeleton />;
  }

  switch (route) {
    case "/dashboard/settings":
      return <SettingsPanel initial={data} />;
    case "/dashboard/usage":
      return <UsagePanel initial={data} />;
    case "/dashboard/spending":
      return <SpendingPanel initial={data} />;
    case "/dashboard/billing":
      return <BillingPanel initial={data} />;
    case "/dashboard":
    default:
      return <OverviewPanel initial={data} />;
  }
}
