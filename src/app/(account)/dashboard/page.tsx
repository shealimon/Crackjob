"use client";

import { OverviewPanel } from "@/components/dashboard/overview-panel";
import { DashboardPanelGate } from "@/components/dashboard/panel-gate";

export default function DashboardOverviewPage() {
  return (
    <DashboardPanelGate>
      {(data) => <OverviewPanel initial={data} />}
    </DashboardPanelGate>
  );
}
