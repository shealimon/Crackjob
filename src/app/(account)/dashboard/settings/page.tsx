"use client";

import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { DashboardPanelGate } from "@/components/dashboard/panel-gate";

export default function DashboardSettingsPage() {
  return (
    <DashboardPanelGate>
      {(data) => <SettingsPanel initial={data} />}
    </DashboardPanelGate>
  );
}
