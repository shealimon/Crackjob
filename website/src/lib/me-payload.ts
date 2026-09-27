import { dailyUsageByDay, listRecentAiUsage } from "@/lib/credits";
import { getActiveDesktopSession, userPublicPayload } from "@/lib/desktop-session";
import type { MeInclude } from "@/lib/me-includes";
import { ME_INCLUDE_ALL } from "@/lib/me-includes";
import { planLabel } from "@/lib/plans";
import { PROFILE_SELECT, toPublicProfile } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

export const DASHBOARD_USAGE_DAYS = 371;
export const DASHBOARD_USAGE_EVENTS = 500;

function resolvedIncludes(includes: MeInclude[] | "all"): Set<MeInclude> {
  if (includes === "all") return new Set(ME_INCLUDE_ALL);
  return new Set(includes);
}

export async function buildMePayload(
  userId: string,
  includes: MeInclude[] | "all",
  source: "web" | "desktop",
) {
  const want = resolvedIncludes(includes);
  const needShell =
    want.has("shell") ||
    want.has("usage") ||
    want.has("events") ||
    want.has("payments");

  const user = needShell ? await userPublicPayload(userId) : null;
  if (!user) {
    return { error: "Not signed in" as const, status: 401 as const };
  }

  const [desktop, usageByDay, usageEvents, profile, paymentRows] =
    await Promise.all([
      want.has("shell")
        ? getActiveDesktopSession(user.id)
        : Promise.resolve(null),
      want.has("usage")
        ? dailyUsageByDay(user.id, DASHBOARD_USAGE_DAYS)
        : Promise.resolve([]),
      want.has("events")
        ? listRecentAiUsage(user.id, DASHBOARD_USAGE_EVENTS)
        : Promise.resolve([]),
      want.has("shell")
        ? prisma.profile.findUnique({
            where: { userId: user.id },
            select: PROFILE_SELECT,
          })
        : Promise.resolve(null),
      want.has("payments")
        ? prisma.payment.findMany({
            where: { userId: user.id, status: "paid" },
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
          })
        : Promise.resolve([]),
    ]);

  return {
    body: {
      user: {
        ...user,
        planLabel: planLabel(user.plan),
      },
      profile: toPublicProfile(profile),
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
      source,
      desktopSession: desktop
        ? {
            id: desktop.id,
            deviceName: desktop.deviceName,
            lastSeenAt: desktop.lastSeenAt,
            createdAt: desktop.createdAt,
          }
        : null,
      includes: includes === "all" ? ME_INCLUDE_ALL : [...want],
    },
  };
}
