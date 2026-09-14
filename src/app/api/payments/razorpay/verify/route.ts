import { activatePaidPlan } from "@/lib/activate-paid-plan";
import { requireUser } from "@/lib/api-auth";
import { json, optionsCors } from "@/lib/http";
import { planLabel } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { parseCheckoutPlan } from "@/lib/razorpay-plans";

export function OPTIONS() {
  return optionsCors();
}

export async function POST(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId =
    typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const paymentId =
    typeof body.razorpay_payment_id === "string"
      ? body.razorpay_payment_id
      : "";
  const signature =
    typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
  const plan = parseCheckoutPlan(body.plan);

  if (!orderId || !paymentId || !signature || !plan) {
    return json({ error: "Missing payment fields" }, { status: 400 });
  }

  const pending = await prisma.payment.findUnique({
    where: { razorpayOrderId: orderId },
  });
  if (!pending || pending.userId !== authed.userId) {
    return json({ error: "Unknown order" }, { status: 404 });
  }
  if (pending.plan !== plan) {
    return json({ error: "Plan mismatch" }, { status: 400 });
  }

  if (
    !verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
    })
  ) {
    await prisma.payment.update({
      where: { id: pending.id },
      data: { status: "failed" },
    });
    return json({ error: "Invalid payment signature" }, { status: 400 });
  }

  try {
    const result = await activatePaidPlan({
      userId: authed.userId,
      plan,
      amountPaise: pending.amountPaise,
      currency: pending.currency,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    });

    const sub = result.subscription;
    return json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed,
      plan: sub?.plan ?? plan,
      planLabel: planLabel(sub?.plan ?? plan),
      endsAt: sub?.endsAt?.toISOString() ?? null,
      status: sub?.status ?? "active",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to activate plan";
    console.error("[razorpay/verify]", message);
    return json({ error: message }, { status: 500 });
  }
}
