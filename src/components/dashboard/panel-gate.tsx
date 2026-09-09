"use client";

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
}: {
  children: (data: DashboardPayload) => React.ReactNode;
}) {
  const { data, loading } = useDashboardData();
  if (!data) {
    return loading ? <PanelSkeleton /> : <PanelSkeleton />;
  }
  return <>{children(data)}</>;
}
