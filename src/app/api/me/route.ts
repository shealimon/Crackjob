import { json, optionsCors } from "@/lib/http";
import { requireUser } from "@/lib/api-auth";
import { dailyUsageByDay, listRecentAiUsage } from "@/lib/credits";
import {
  getActiveDesktopSession,
  userPublicPayload,
} from "@/lib/desktop-session";
import { planLabel } from "@/lib/plans";
import { PROFILE_SELECT, toPublicProfile } from "@/lib/profile";
import { prisma } from "@/lib/prisma";

export function OPTIONS() {
  return optionsCors();
}

export async function GET(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const user = await userPublicPayload(authed.userId);
  if (!user) {
    // Stale JWT after DB delete — treat as signed out (client clears session).
    return json({ error: "Not signed in" }, { status: 401 });
  }

  const [desktop, usageByDay, usageEvents, profile, paymentRows] =
    await Promise.all([
      getActiveDesktopSession(user.id),
      dailyUsageByDay(user.id, 371),
      listRecentAiUsage(user.id, 500),
      prisma.profile.findUnique({
        where: { userId: user.id },
        select: PROFILE_SELECT,
      }),
      prisma.payment.findMany({
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
      }),
    ]);

  return json({
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
    source: authed.source,
    desktopSession: desktop
      ? {
          id: desktop.id,
          deviceName: desktop.deviceName,
          lastSeenAt: desktop.lastSeenAt,
          createdAt: desktop.createdAt,
        }
      : null,
  });
}
