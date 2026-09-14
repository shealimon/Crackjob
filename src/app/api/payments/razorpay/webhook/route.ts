import { activatePaidPlan } from "@/lib/activate-paid-plan";
import { json } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import {
  getRazorpayWebhookSecret,
  verifyWebhookSignature,
} from "@/lib/razorpay";
import {
  parseCheckoutPlan,
  RAZORPAY_PLAN_AMOUNT_PAISE,
  type PaidCheckoutPlan,
} from "@/lib/razorpay-plans";

export async function POST(request: Request) {
  if (!getRazorpayWebhookSecret()) {
    return json(
      { error: "Webhook secret not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          amount?: number;
          currency?: string;
          status?: string;
          notes?: Record<string, string>;
        };
      };
      order?: {
        entity?: {
          id?: string;
          notes?: Record<string, string>;
        };
      };
    };
  };

  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = event.event ?? "";
  if (
    name !== "payment.captured" &&
    name !== "order.paid" &&
    name !== "payment.authorized"
  ) {
    return json({ ok: true, ignored: name });
  }

  const paymentEntity = event.payload?.payment?.entity;
  const orderId =
    paymentEntity?.order_id || event.payload?.order?.entity?.id || "";
  const paymentId = paymentEntity?.id || "";
  if (!orderId) {
    return json({ ok: true, skipped: "missing order id" });
  }

  const pending = await prisma.payment.findUnique({
    where: { razorpayOrderId: orderId },
  });

  const notes = {
    ...(event.payload?.order?.entity?.notes ?? {}),
    ...(paymentEntity?.notes ?? {}),
  };
  const planFromNotes = parseCheckoutPlan(notes.plan);
  const plan = (pending?.plan as PaidCheckoutPlan | undefined) ?? planFromNotes;
  const userId = pending?.userId ?? notes.userId;

  if (!userId || !plan) {
    console.error("[razorpay/webhook] missing user/plan", { orderId, notes });
    return json({ error: "Missing user or plan" }, { status: 400 });
  }

  if (!paymentId) {
    return json({ ok: true, skipped: "missing payment id" });
  }

  try {
    await activatePaidPlan({
      userId,
      plan,
      amountPaise:
        pending?.amountPaise ??
        Number(paymentEntity?.amount) ??
        RAZORPAY_PLAN_AMOUNT_PAISE[plan],
      currency: pending?.currency ?? paymentEntity?.currency ?? "INR",
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
    });
    return json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook activate failed";
    console.error("[razorpay/webhook]", message);
    return json({ error: message }, { status: 500 });
  }
}
