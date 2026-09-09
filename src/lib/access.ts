import { prisma } from "@/lib/prisma";
import {
  FREE_DAILY_SOLVES,
  isPaidPlan,
  type SubscriptionPlan,
} from "@/lib/plans";

export type AccessSnapshot = {
  userId: string;
  plan: SubscriptionPlan | string;
  status: string;
  endsAt: Date | null;
  fullAccess: boolean;
  exploreRemaining: number | null;
  solvesToday: number;
};

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Avoid a DB round-trip on every Ctrl+Enter (was adding hundreds of ms before OpenAI). */
const ACCESS_CACHE_TTL_MS = 20_000;
const accessCache = new Map<string, { at: number; access: AccessSnapshot }>();

export function invalidateAccessCache(userId?: string) {
  if (!userId) {
    accessCache.clear();
    return;
  }
  accessCache.delete(userId);
}

export async function getAccessSnapshot(userId: string): Promise<AccessSnapshot> {
  const cached = accessCache.get(userId);
  if (cached && Date.now() - cached.at < ACCESS_CACHE_TTL_MS) {
    return cached.access;
  }

  // Subscription first — paid users skip the daily count query (saves a DB round-trip on every solve).
  const sub = await prisma.subscription.findUnique({ where: { userId } });

  const plan = sub?.plan ?? "free";
  const status = sub?.status ?? "active";
  const endsAt = sub?.endsAt ?? null;

  const paidActive =
    isPaidPlan(plan) &&
    status === "active" &&
    (endsAt === null || endsAt.getTime() > Date.now());

  let access: AccessSnapshot;
  if (paidActive) {
    access = {
      userId,
      plan,
      status,
      endsAt,
      fullAccess: true,
      exploreRemaining: null,
      solvesToday: 0,
    };
  } else {
    const solvesToday = await prisma.aiUsage.count({
      where: {
        userId,
        status: "done",
        createdAt: { gte: startOfUtcDay() },
      },
    });

    // Expired paid → treat as free explore
    access = {
      userId,
      plan: "free",
      status: "active",
      endsAt: null,
      fullAccess: false,
      exploreRemaining: Math.max(0, FREE_DAILY_SOLVES - solvesToday),
      solvesToday,
    };
  }

  accessCache.set(userId, { at: Date.now(), access });
  return access;
}

export async function assertCanSolve(userId: string) {
  const access = await getAccessSnapshot(userId);
  if (access.fullAccess) return access;
  if ((access.exploreRemaining ?? 0) <= 0) {
    const err = new Error(
      `Daily free limit reached (${FREE_DAILY_SOLVES}/day). Upgrade for unlimited access.`,
    );
    (err as Error & { code?: string }).code = "EXPLORE_LIMIT";
    throw err;
  }
  return access;
}
