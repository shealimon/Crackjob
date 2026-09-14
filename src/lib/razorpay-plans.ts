import {
  endsAtForPlan,
  isPaidPlan,
  normalizePlan,
  type SubscriptionPlan,
} from "@/lib/plans";

export type PaidCheckoutPlan = Exclude<SubscriptionPlan, "free">;

/** Server-only prices in paise — never trust client amount. */
export const RAZORPAY_PLAN_AMOUNT_PAISE: Record<PaidCheckoutPlan, number> = {
  month_1: 499_900,
  month_3: 1_249_900,
  year: 4_499_900,
};

export function parseCheckoutPlan(raw: unknown): PaidCheckoutPlan | null {
  if (typeof raw !== "string") return null;
  const plan = normalizePlan(raw);
  if (!isPaidPlan(plan)) return null;
  return plan;
}

/**
 * Renew / repurchase: if still active, extend from current endsAt;
 * otherwise start from now.
 */
export function endsAtAfterPurchase(
  plan: PaidCheckoutPlan,
  currentEndsAt: Date | null | undefined,
  from = new Date(),
): Date {
  const base =
    currentEndsAt && currentEndsAt.getTime() > from.getTime()
      ? currentEndsAt
      : from;
  const ends = endsAtForPlan(plan, base);
  if (!ends) {
    throw new Error(`Missing endsAt for plan ${plan}`);
  }
  return ends;
}

export function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
