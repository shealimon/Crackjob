/** free forever explore; paid full access */
export const SUBSCRIPTION_PLANS = ["free", "month_1", "month_3", "year"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const PAID_PLANS: SubscriptionPlan[] = ["month_1", "month_3", "year"];

/**
 * Free explore is a one-time lifetime quota (not daily):
 * first N answers full, next M half+upgrade, then permanently blocked until upgrade.
 */
export const FREE_FULL_SOLVES = 10;
export const FREE_PARTIAL_SOLVES = 5;
export const FREE_EXPLORE_SOLVES = FREE_FULL_SOLVES + FREE_PARTIAL_SOLVES;
/** @deprecated Use FREE_EXPLORE_SOLVES — quota is lifetime, not daily. */
export const FREE_DAILY_SOLVES = FREE_EXPLORE_SOLVES;

export const FREE_PARTIAL_UPGRADE_MSG =
  "Preview only — upgrade for the full answer and unlimited solves.";

export const FREE_LIMIT_UPGRADE_MSG =
  "Free explore limit reached.\nUpgrade for Unlimited Access.";

/** Map common aliases / typos → canonical plan ids used in DB + access checks. */
export function normalizePlan(plan: string | null | undefined): string {
  const raw = (plan ?? "free").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const aliases: Record<string, string> = {
    monthly: "month_1",
    month: "month_1",
    "1_month": "month_1",
    month1: "month_1",
    "1month": "month_1",
    pro_monthly: "month_1",
    quarterly: "month_3",
    "3_month": "month_3",
    "3_months": "month_3",
    month3: "month_3",
    "3month": "month_3",
    pro_quarterly: "month_3",
    yearly: "year",
    annual: "year",
    annually: "year",
    pro_yearly: "year",
    pro: "year",
  };
  return aliases[raw] ?? raw;
}

export function isPaidPlan(plan: string): plan is Exclude<SubscriptionPlan, "free"> {
  return PAID_PLANS.includes(normalizePlan(plan) as Exclude<SubscriptionPlan, "free">);
}

export function planLabel(plan: string): string {
  switch (normalizePlan(plan)) {
    case "month_1":
      return "1 month";
    case "month_3":
      return "3 months";
    case "year":
      return "Yearly";
    default:
      return "Free explore";
  }
}

export function endsAtForPlan(plan: SubscriptionPlan, from = new Date()): Date | null {
  if (plan === "free") return null;
  const end = new Date(from);
  if (plan === "month_1") {
    end.setMonth(end.getMonth() + 1);
    return end;
  }
  if (plan === "month_3") {
    end.setMonth(end.getMonth() + 3);
    return end;
  }
  if (plan === "year") {
    end.setFullYear(end.getFullYear() + 1);
    return end;
  }
  return null;
}
