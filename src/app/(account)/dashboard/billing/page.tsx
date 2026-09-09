import { BillingPanel } from "@/components/dashboard/billing-panel";
import { getDashboardShell } from "@/lib/dashboard-data";

export default async function DashboardBillingPage() {
  const data = await getDashboardShell();
  return <BillingPanel initial={{ ...data, usageByDay: [] }} />;
}
