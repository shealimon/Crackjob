import { UsagePanel } from "@/components/dashboard/usage-panel";
import { getDashboardPayload } from "@/lib/dashboard-data";

export default async function DashboardUsagePage() {
  const data = await getDashboardPayload();
  return <UsagePanel initial={data} />;
}
