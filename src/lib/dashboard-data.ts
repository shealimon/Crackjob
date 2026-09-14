import { cache } from "react";
import { auth } from "@/auth";
import { clearSessionToLogin } from "@/lib/clear-session-login";
import { dailyUsageByDay, listRecentAiUsage } from "@/lib/credits";
import type { AiUsageEvent } from "@/lib/credits";
import { getActiveDesktopSession, userPublicPayload } from "@/lib/desktop-session";
import { planLabel } from "@/lib/plans";
import { PROFILE_SELECT, toPublicProfile, type PublicProfile } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

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

export type DashboardPayment = {
  id: string;
  plan: string;
  amountPaise: number;
  currency: string;
  status: string;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type DashboardUsageDay = {
  date: string;
  creditsUsed: number;
  solves: number;
  exploreSolves: number;
  fullSolves: number;
};

export type DashboardUsageEvent = AiUsageEvent;

export type DashboardProfile = PublicProfile;

export type DashboardPayload = {
  user: DashboardUser;
  usageByDay: DashboardUsageDay[];
  usageEvents: DashboardUsageEvent[];
  payments: DashboardPayment[];
  profile: DashboardProfile;
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
  const [raw, desktop, profile] = await Promise.all([
    userPublicPayload(userId),
    getActiveDesktopSession(userId),
    prisma.profile.findUnique({
      where: { userId },
      select: PROFILE_SELECT,
    }),
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
    profile: toPublicProfile(profile),
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

/** Usage / billing pages — includes chart series + invoices. */
export const getDashboardPayload = cache(async (): Promise<DashboardPayload> => {
  const userId = await requireUserId();
  const [shell, usageByDay, usageEvents, paymentRows] = await Promise.all([
    getDashboardShell(),
    dailyUsageByDay(userId, 371),
    listRecentAiUsage(userId, 500),
    prisma.payment.findMany({
      where: { userId, status: "paid" },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        plan: true,
        amountPaise: true,
        currency: true,
        status: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        createdAt: true,
        paidAt: true,
      },
    }),
  ]);

  return {
    ...shell,
    usageByDay,
    usageEvents,
    payments: paymentRows.map((p) => ({
      id: p.id,
      plan: p.plan,
      amountPaise: p.amountPaise,
      currency: p.currency,
      status: p.status,
      razorpayOrderId: p.razorpayOrderId,
      razorpayPaymentId: p.razorpayPaymentId,
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
    })),
  };
});
