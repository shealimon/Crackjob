"use client";

import { UsagePanel } from "@/components/dashboard/usage-panel";
import { DashboardPanelGate } from "@/components/dashboard/panel-gate";

export default function DashboardUsagePage() {
  return (
    <DashboardPanelGate>
      {(data) => <UsagePanel initial={data} />}
    </DashboardPanelGate>
  );
}
