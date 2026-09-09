"use client";

import { BillingPanel } from "@/components/dashboard/billing-panel";
import { DashboardPanelGate } from "@/components/dashboard/panel-gate";

export default function DashboardBillingPage() {
  return (
    <DashboardPanelGate>
      {(data) => <BillingPanel initial={data} />}
    </DashboardPanelGate>
  );
}
