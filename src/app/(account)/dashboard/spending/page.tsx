"use client";

import { SpendingPanel } from "@/components/dashboard/spending-panel";
import { DashboardPanelGate } from "@/components/dashboard/panel-gate";

export default function DashboardSpendingPage() {
  return (
    <DashboardPanelGate>
      {(data) => <SpendingPanel initial={data} />}
    </DashboardPanelGate>
  );
}
