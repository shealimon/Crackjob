/**
 * Interactive screen refresh policy (Step 5).
 * Event-driven + manual only — no continuous capture, no AI on refresh.
 */

import { hashImageFingerprint } from "./taskSession";

/** Minimum gap between non-forced Interactive captures. */
export const INTERACTIVE_CAPTURE_MIN_INTERVAL_MS = 2500;

export type InteractiveCaptureReason =
  | "manual"
  | "activation"
  | "question"
  | "candidate_input"
  | "answer_complete";

export type InteractiveCapturePolicy = {
  enabled: boolean;
  lastCaptureAt: number;
  /** Fingerprint of last accepted capture — suppresses identical re-captures. */
  lastHash?: string;
};

export type InteractiveCaptureDecision =
  | { allow: true }
  | { allow: false; reason: "disabled" | "cooldown" | "duplicate" | "empty" };

export function createInteractiveCapturePolicy(): InteractiveCapturePolicy {
  return { enabled: false, lastCaptureAt: 0 };
}

export function enableInteractiveCapturePolicy(
  policy: InteractiveCapturePolicy = createInteractiveCapturePolicy(),
): InteractiveCapturePolicy {
  return { ...policy, enabled: true };
}

export function disableInteractiveCapturePolicy(): InteractiveCapturePolicy {
  return createInteractiveCapturePolicy();
}

/**
 * Decide whether an Interactive refresh should run.
 * `manual` and `force` bypass the cooldown (still require enabled).
 * Duplicate hash suppression applies after a capture exists.
 */
export function decideInteractiveCapture(
  policy: InteractiveCapturePolicy,
  reason: InteractiveCaptureReason,
  now = Date.now(),
  opts?: { force?: boolean; proposedHash?: string },
): InteractiveCaptureDecision {
  if (!policy.enabled) {
    return { allow: false, reason: "disabled" };
  }

  const force = Boolean(opts?.force) || reason === "manual";

  if (
    !force &&
    policy.lastCaptureAt > 0 &&
    now - policy.lastCaptureAt < INTERACTIVE_CAPTURE_MIN_INTERVAL_MS
  ) {
    return { allow: false, reason: "cooldown" };
  }

  if (
    !force &&
    opts?.proposedHash &&
    policy.lastHash &&
    opts.proposedHash === policy.lastHash
  ) {
    return { allow: false, reason: "duplicate" };
  }

  return { allow: true };
}

/** Record a successful accepted capture on the policy clock. */
export function markInteractiveCaptureAccepted(
  policy: InteractiveCapturePolicy,
  imageBase64: string,
  now = Date.now(),
): InteractiveCapturePolicy {
  return {
    ...policy,
    lastCaptureAt: now,
    lastHash: hashImageFingerprint(imageBase64),
  };
}

/** True when payload looks like a usable JPEG/base64 capture. */
export function isValidCapturePayload(imageBase64: string | null | undefined): boolean {
  return Boolean(imageBase64 && imageBase64.trim().length >= 24);
}

/**
 * Post-capture gate: reject empty/invalid; optionally suppress identical frames.
 * Never returns an empty image as a replacement for a prior valid one.
 */
export function acceptInteractiveCapturePayload(
  policy: InteractiveCapturePolicy,
  imageBase64: string,
  reason: InteractiveCaptureReason,
  opts?: { force?: boolean; now?: number },
): InteractiveCaptureDecision & { hash?: string } {
  if (!isValidCapturePayload(imageBase64)) {
    return { allow: false, reason: "empty" };
  }
  const hash = hashImageFingerprint(imageBase64);
  const decision = decideInteractiveCapture(policy, reason, opts?.now ?? Date.now(), {
    force: opts?.force,
    proposedHash: hash,
  });
  if (!decision.allow) return decision;
  return { allow: true, hash };
}
