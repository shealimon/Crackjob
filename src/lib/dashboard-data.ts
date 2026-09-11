import { cache } from "react";
import { auth } from "@/auth";
import { clearSessionToLogin } from "@/lib/clear-session-login";
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

async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id?.trim();
  if (!userId) {
    // Cookie may still be present while auth() is empty — clear it or login loops.
    return clearSessionToLogin();
  }
  return userId;
}

/** Sidebar chrome only — keep layout fetch minimal for faster navigations. */
export const getDashboardNavUser = cache(async () => {
  const userId = await requireUserId();
  const raw = await userPublicPayload(userId);
  if (!raw) return clearSessionToLogin();
  return {
    name: raw.name,
    email: raw.email,
    planLabel:
      !raw.fullAccess && raw.planStatus === "expired"
        ? `${planLabel(raw.plan)} (ended)`
        : planLabel(raw.plan),
    fullAccess: raw.fullAccess,
  };
});

/** Shell / overview — no 14-day usage scan. */
export const getDashboardShell = cache(async () => {
  const userId = await requireUserId();
  const [raw, desktop] = await Promise.all([
    userPublicPayload(userId),
    getActiveDesktopSession(userId),
  ]);
  if (!raw) return clearSessionToLogin();

  const user: DashboardUser = {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    image: raw.image,
    plan: raw.plan,
    planLabel:
      !raw.fullAccess && raw.planStatus === "expired"
        ? `${planLabel(raw.plan)} (ended)`
        : planLabel(raw.plan),
    fullAccess: raw.fullAccess,
    exploreRemaining: raw.exploreRemaining,
    solvesToday: raw.solvesToday,
    endsAt: raw.endsAt,
    creditBalance: raw.creditBalance,
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
