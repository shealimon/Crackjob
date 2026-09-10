"use client";

import { useEffect, useRef, useState } from "react";
import { useDashboardData } from "@/components/dashboard/dashboard-data";
import type { DashboardPayload } from "@/lib/dashboard-data";

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

export function DashboardPanelGate({
  children,
  requireUsage = false,
}: {
  children: (data: DashboardPayload) => React.ReactNode;
  /** Usage/spending need the 14-day series — fetch on demand, not on every dashboard mount. */
  requireUsage?: boolean;
}) {
  const { data, loading, refresh } = useDashboardData();
  const fetchedUsage = useRef(false);
  const [usageLoading, setUsageLoading] = useState(
    () => requireUsage && Boolean(data && data.usageByDay.length === 0),
  );

  useEffect(() => {
    if (!requireUsage || !data || data.usageByDay.length > 0 || fetchedUsage.current) {
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
  }, [requireUsage, data, refresh]);

  if (!data) {
    if (loading) return <PanelSkeleton />;
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-6 text-sm text-black/60">
        Could not load dashboard data. Refresh the page or sign in again.
      </div>
    );
  }

  if (requireUsage && usageLoading && data.usageByDay.length === 0) {
    return <PanelSkeleton />;
  }

  return <>{children(data)}</>;
}
