import { json, optionsCors } from "@/lib/http";
import { requireUser } from "@/lib/api-auth";
import { dailyUsageByDay } from "@/lib/credits";
import {
  getActiveDesktopSession,
  userPublicPayload,
} from "@/lib/desktop-session";
import { planLabel } from "@/lib/plans";
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
    return json({ error: "User not found" }, { status: 404 });
  }

  const [desktop, usageByDay, profile] = await Promise.all([
    getActiveDesktopSession(user.id),
    dailyUsageByDay(user.id, 14),
    prisma.profile.findUnique({
      where: { userId: user.id },
      select: { targetRole: true, resumeText: true },
    }),
  ]);

  return json({
    user: {
      ...user,
      planLabel: planLabel(user.plan),
    },
    profile: profile
      ? {
          targetRole: profile.targetRole,
          hasResume: Boolean(profile.resumeText?.trim()),
        }
      : { targetRole: null, hasResume: false },
    usageByDay,
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
