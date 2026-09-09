import { SpendingPanel } from "@/components/dashboard/spending-panel";
import { getDashboardPayload } from "@/lib/dashboard-data";

export default async function DashboardSpendingPage() {
  const data = await getDashboardPayload();
  return <SpendingPanel initial={data} />;
}
