import { prisma } from "@/lib/prisma";
import {
  freeAnswerTier,
  type FreeAnswerTier,
} from "@/lib/explore-answer";
import {
  FREE_EXPLORE_SOLVES,
  FREE_LIMIT_UPGRADE_MSG,
  isPaidPlan,
  type SubscriptionPlan,
} from "@/lib/plans";

export type AccessSnapshot = {
  userId: string;
  plan: SubscriptionPlan | string;
  status: string;
  endsAt: Date | null;
  fullAccess: boolean;
  /** Remaining lifetime free explore solves (full + partial). Null when paid. */
  exploreRemaining: number | null;
  /**
   * Explore solves already used (lifetime, accessLevel=explore).
   * Field name kept for API compatibility with the desktop app.
   */
  solvesToday: number;
  /** Tier for the next solve. Null when paid / full access. */
  answerTier: FreeAnswerTier | null;
};

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

  // Subscription first — paid users skip the explore count query.
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
      answerTier: null,
    };
  } else {
    // Lifetime free quota — only count explore-tier solves (paid usage must not burn free allotment).
    const exploreUsed = await prisma.aiUsage.count({
      where: {
        userId,
        status: "done",
        accessLevel: "explore",
      },
    });

    // Expired paid → treat as free explore (lifetime remaining)
    access = {
      userId,
      plan: "free",
      status: "active",
      endsAt: null,
      fullAccess: false,
      exploreRemaining: Math.max(0, FREE_EXPLORE_SOLVES - exploreUsed),
      solvesToday: exploreUsed,
      answerTier: freeAnswerTier(exploreUsed),
    };
  }

  accessCache.set(userId, { at: Date.now(), access });
  return access;
}

export async function assertCanSolve(userId: string) {
  const access = await getAccessSnapshot(userId);
  if (access.fullAccess) return access;
  if (access.answerTier === "blocked" || (access.exploreRemaining ?? 0) <= 0) {
    const err = new Error(FREE_LIMIT_UPGRADE_MSG);
    (err as Error & { code?: string }).code = "EXPLORE_LIMIT";
    throw err;
  }
  return access;
}
