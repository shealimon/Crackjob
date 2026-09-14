import { invalidateAccessCache } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  endsAtAfterPurchase,
  type PaidCheckoutPlan,
} from "@/lib/razorpay-plans";
import { ensureUserBundle } from "@/lib/user-bundle";

export type ActivatePaidPlanInput = {
  userId: string;
  plan: PaidCheckoutPlan;
  amountPaise: number;
  currency?: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string | null;
};

/**
 * Idempotent: same razorpayPaymentId / already-paid order will not double-extend.
 * Repeat purchases extend endsAt from the later of now or current endsAt.
 */
export async function activatePaidPlan(input: ActivatePaidPlanInput) {
  await ensureUserBundle(input.userId);

  const existingByPayment = input.razorpayPaymentId
    ? await prisma.payment.findFirst({
        where: { razorpayPaymentId: input.razorpayPaymentId },
      })
    : null;
  if (existingByPayment?.status === "paid") {
    const sub = await prisma.subscription.findUnique({
      where: { userId: input.userId },
    });
    return { alreadyProcessed: true as const, subscription: sub };
  }

  const pending = await prisma.payment.findUnique({
    where: { razorpayOrderId: input.razorpayOrderId },
  });
  if (pending?.status === "paid") {
    const sub = await prisma.subscription.findUnique({
      where: { userId: input.userId },
    });
    return { alreadyProcessed: true as const, subscription: sub };
  }

  if (pending && pending.userId !== input.userId) {
    throw new Error("Order does not belong to this user");
  }
  if (pending && pending.plan !== input.plan) {
    throw new Error("Order plan mismatch");
  }

  const now = new Date();
  const current = await prisma.subscription.findUnique({
    where: { userId: input.userId },
  });
  const endsAt = endsAtAfterPurchase(input.plan, current?.endsAt, now);

  const result = await prisma.$transaction(async (tx) => {
    const payment = pending
      ? await tx.payment.update({
          where: { id: pending.id },
          data: {
            status: "paid",
            plan: input.plan,
            amountPaise: input.amountPaise,
            currency: input.currency ?? "INR",
            razorpayPaymentId: input.razorpayPaymentId,
            razorpaySignature: input.razorpaySignature ?? null,
            paidAt: now,
          },
        })
      : await tx.payment.create({
          data: {
            userId: input.userId,
            plan: input.plan,
            amountPaise: input.amountPaise,
            currency: input.currency ?? "INR",
            status: "paid",
            razorpayOrderId: input.razorpayOrderId,
            razorpayPaymentId: input.razorpayPaymentId,
            razorpaySignature: input.razorpaySignature ?? null,
            paidAt: now,
          },
        });

    const subscription = await tx.subscription.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        plan: input.plan,
        status: "active",
        startsAt: now,
        endsAt,
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        amountPaise: input.amountPaise,
        currency: input.currency ?? "INR",
      },
      update: {
        plan: input.plan,
        status: "active",
        startsAt: current?.startsAt ?? now,
        endsAt,
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        amountPaise: input.amountPaise,
        currency: input.currency ?? "INR",
      },
    });

    return { payment, subscription };
  });

  invalidateAccessCache(input.userId);
  return { alreadyProcessed: false as const, ...result };
}
