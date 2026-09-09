import { OverviewPanel } from "@/components/dashboard/overview-panel";
import { getDashboardShell } from "@/lib/dashboard-data";

export default async function DashboardOverviewPage() {
  const data = await getDashboardShell();
  return (
    <OverviewPanel
      initial={{
        ...data,
        usageByDay: [],
      }}
    />
  );
}
