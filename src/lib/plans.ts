/** free forever explore; paid full access */
export const SUBSCRIPTION_PLANS = ["free", "month_1", "month_3", "year"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const PAID_PLANS: SubscriptionPlan[] = ["month_1", "month_3", "year"];

/** Free explore: max full solves per calendar day (UTC). Temporarily 100 for development. */
export const FREE_DAILY_SOLVES = 100;

export function isPaidPlan(plan: string): plan is Exclude<SubscriptionPlan, "free"> {
  return PAID_PLANS.includes(plan as Exclude<SubscriptionPlan, "free">);
}

export function planLabel(plan: string): string {
  switch (plan) {
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
