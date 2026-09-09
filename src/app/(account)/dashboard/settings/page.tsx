import { SettingsPanel } from "@/components/dashboard/settings-panel";
import { getDashboardShell } from "@/lib/dashboard-data";

export default async function DashboardSettingsPage() {
  const data = await getDashboardShell();
  return <SettingsPanel initial={{ ...data, usageByDay: [] }} />;
}
