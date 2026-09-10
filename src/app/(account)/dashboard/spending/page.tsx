"use client";

import { SpendingPanel } from "@/components/dashboard/spending-panel";
import { DashboardPanelGate } from "@/components/dashboard/panel-gate";

export default function DashboardSpendingPage() {
  return (
    <DashboardPanelGate requireUsage>
      {(data) => <SpendingPanel initial={data} />}
    </DashboardPanelGate>
  );
}
