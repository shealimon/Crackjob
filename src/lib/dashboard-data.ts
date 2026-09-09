import { cache } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { dailyUsageByDay } from "@/lib/credits";
import { getActiveDesktopSession, userPublicPayload } from "@/lib/desktop-session";
import { planLabel } from "@/lib/plans";

export type DashboardUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  plan: string;
  planLabel: string;
  fullAccess: boolean;
  exploreRemaining: number | null;
  solvesToday: number;
  endsAt: string | null;
  creditBalance: number;
};

export type DashboardPayload = {
  user: DashboardUser;
  usageByDay: { date: string; creditsUsed: number }[];
  desktopSession: {
    id: string;
    deviceName: string | null;
    lastSeenAt: string;
    createdAt: string;
  } | null;
};

async function requireUserId() {
  const session = await auth();
  const userId = session?.user?.id?.trim();
  if (!userId) {
    redirect("/login?callbackUrl=/dashboard");
  }
  return userId;
}

/** Shell / overview — no 14-day usage scan. */
export const getDashboardShell = cache(async () => {
  const userId = await requireUserId();
  const [raw, desktop] = await Promise.all([
    userPublicPayload(userId),
    getActiveDesktopSession(userId),
  ]);
  if (!raw) redirect("/login");

  const user: DashboardUser = {
    ...raw,
    planLabel: planLabel(raw.plan),
  };

  return {
    user,
    desktopSession: desktop
      ? {
          id: desktop.id,
          deviceName: desktop.deviceName,
          lastSeenAt: desktop.lastSeenAt.toISOString(),
          createdAt: desktop.createdAt.toISOString(),
        }
      : null,
  };
});

/** Usage / spending pages — includes chart series. */
export const getDashboardPayload = cache(async (): Promise<DashboardPayload> => {
  const userId = await requireUserId();
  const shell = await getDashboardShell();
  const usageByDay = await dailyUsageByDay(userId, 14);
  return { ...shell, usageByDay };
});
