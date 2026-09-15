"use client";

import { useEffect, useRef, useState } from "react";
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
  const { data, loading, refresh } = useDashboardData();
  const route = normalizePath(path);
  const needsUsage =
    route === "/dashboard" || route === "/dashboard/usage";
  const needsBilling = route === "/dashboard/billing";
  const needsProfile = route === "/dashboard/settings";
  const fetched = useRef(new Set<string>());
  const [extraLoading, setExtraLoading] = useState(false);

  // Sync: know we still need a first fetch before useEffect runs (avoids empty flash).
  const billingPending =
    data != null && needsBilling && !fetched.current.has("billing");
  const usagePending =
    data != null &&
    needsUsage &&
    data.usageByDay.length === 0 &&
    !fetched.current.has("usage");

  useEffect(() => {
    if (!data) return;

    let key: string | null = null;
    if (needsBilling) key = "billing";
    else if (needsUsage && data.usageByDay.length === 0) key = "usage";
    else if (needsProfile) key = "profile";

    if (!key || fetched.current.has(key)) {
      setExtraLoading(false);
      return;
    }

    fetched.current.add(key);
    let cancelled = false;
    // Don't block settings UI on profile refresh.
    if (key !== "profile") setExtraLoading(true);
    void refresh().finally(() => {
      if (!cancelled) setExtraLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [needsBilling, needsUsage, needsProfile, data, refresh]);

  if (route === "/dashboard/questions") {
    return <QuestionsPanel />;
  }

  if (!data) {
    if (loading) return <PanelLoading />;
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/60">
        Could not load dashboard data. Refresh the page or sign in again.
      </div>
    );
  }

  // Overview can render plan cards immediately; heatmap fills in after usage fetch.
  const overviewReady = route === "/dashboard";
  const waitingOnPanelData =
    !overviewReady &&
    ((needsBilling && (billingPending || extraLoading)) ||
      (needsUsage &&
        data.usageByDay.length === 0 &&
        (usagePending || extraLoading)));

  if (waitingOnPanelData) {
    return <PanelLoading />;
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
