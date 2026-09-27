import crypto from "crypto";
import Razorpay from "razorpay";

function trimEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "") ?? "";
}

export function getRazorpayKeyId() {
  return (
    trimEnv(process.env.RAZORPAY_KEY_ID) ||
    trimEnv(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID)
  );
}

export function getRazorpayKeySecret() {
  return trimEnv(process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpayWebhookSecret() {
  return trimEnv(process.env.RAZORPAY_WEBHOOK_SECRET);
}

export function assertRazorpayConfigured() {
  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys are not configured");
  }
  return { keyId, keySecret };
}

export function getRazorpayClient() {
  const { keyId, keySecret } = assertRazorpayConfigured();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = getRazorpayKeySecret();
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(input.signature),
    );
  } catch {
    return false;
  }
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = getRazorpayWebhookSecret();
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
