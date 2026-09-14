import { requireUser } from "@/lib/api-auth";
import { json, optionsCors } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  assertRazorpayConfigured,
  getRazorpayClient,
  getRazorpayKeyId,
} from "@/lib/razorpay";
import {
  parseCheckoutPlan,
  RAZORPAY_PLAN_AMOUNT_PAISE,
} from "@/lib/razorpay-plans";
import { ensureUserBundle } from "@/lib/user-bundle";

export function OPTIONS() {
  return optionsCors();
}

export async function POST(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  try {
    assertRazorpayConfigured();
  } catch {
    return json({ error: "Payments are not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = parseCheckoutPlan(
    body && typeof body === "object" && "plan" in body
      ? (body as { plan: unknown }).plan
      : null,
  );
  if (!plan) {
    return json(
      { error: "Invalid plan. Use month_1, month_3, or year." },
      { status: 400 },
    );
  }

  const amountPaise = RAZORPAY_PLAN_AMOUNT_PAISE[plan];
  await ensureUserBundle(authed.userId);

  const receipt = `ck_${authed.userId.slice(-8)}_${Date.now().toString(36)}`.slice(
    0,
    40,
  );

  try {
    const razorpay = getRazorpayClient();
    const order = (await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        userId: authed.userId,
        plan,
      },
    })) as { id: string; amount: number | string; currency: string };

    await prisma.payment.create({
      data: {
        userId: authed.userId,
        plan,
        amountPaise,
        currency: "INR",
        status: "created",
        razorpayOrderId: order.id,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: authed.userId },
      select: {
        email: true,
        profile: { select: { firstName: true, lastName: true } },
      },
    });
    const prefillName = [user?.profile?.firstName, user?.profile?.lastName]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ");

    return json({
      orderId: order.id,
      amount: Number(order.amount),
      currency: order.currency || "INR",
      keyId: getRazorpayKeyId(),
      plan,
      prefill: {
        name: prefillName,
        email: user?.email ?? "",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create order";
    console.error("[razorpay/create-order]", message);
    return json({ error: message }, { status: 502 });
  }
}
