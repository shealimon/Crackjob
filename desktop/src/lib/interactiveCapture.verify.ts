/**
 * Interactive capture policy tests (Step 5).
 * Run: npx tsx src/lib/interactiveCapture.verify.ts
 */
import {
  INTERACTIVE_CAPTURE_MIN_INTERVAL_MS,
  acceptInteractiveCapturePayload,
  createInteractiveCapturePolicy,
  decideInteractiveCapture,
  disableInteractiveCapturePolicy,
  enableInteractiveCapturePolicy,
  isValidCapturePayload,
  markInteractiveCaptureAccepted,
} from "./interactiveCapture";
import {
  applyInteractiveCapture,
  createIdleInteractiveState,
  enableInteractiveHandsOn,
  preserveInteractiveOnCaptureFailure,
  buildInteractiveSolveRequest,
} from "./interactiveOrchestration";
import { hashImageFingerprint } from "./taskSession";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const IMG_A = "a".repeat(48);
const IMG_B = "b".repeat(48);

// --- Manual refresh always allowed when enabled ---
{
  const policy = enableInteractiveCapturePolicy();
  const d = decideInteractiveCapture(policy, "manual", Date.now());
  assert(d.allow, "manual allow");
}

// --- Activation / question / candidate / answer_complete respect cooldown ---
{
  let policy = enableInteractiveCapturePolicy();
  policy = markInteractiveCaptureAccepted(policy, IMG_A, 1000);
  const blocked = decideInteractiveCapture(policy, "question", 1000 + 500);
  assert(!blocked.allow && blocked.reason === "cooldown", "cooldown blocks question");
  const after = decideInteractiveCapture(
    policy,
    "question",
    1000 + INTERACTIVE_CAPTURE_MIN_INTERVAL_MS + 1,
  );
  assert(after.allow, "after interval allows");
}

// --- Force bypasses cooldown ---
{
  let policy = enableInteractiveCapturePolicy();
  policy = markInteractiveCaptureAccepted(policy, IMG_A, 1000);
  const forced = decideInteractiveCapture(policy, "activation", 1100, { force: true });
  assert(forced.allow, "force bypass");
}

// --- Interactive OFF / disabled blocks ---
{
  const idle = createInteractiveCapturePolicy();
  const d = decideInteractiveCapture(idle, "question", Date.now());
  assert(!d.allow && d.reason === "disabled", "disabled blocks event-driven");
  const off = disableInteractiveCapturePolicy();
  assert(!decideInteractiveCapture(off, "answer_complete", Date.now()).allow, "cleared blocks");
}

// --- Duplicate hash suppression ---
{
  let policy = enableInteractiveCapturePolicy();
  policy = markInteractiveCaptureAccepted(policy, IMG_A, 1000);
  const dup = acceptInteractiveCapturePayload(policy, IMG_A, "question", {
    now: 1000 + INTERACTIVE_CAPTURE_MIN_INTERVAL_MS + 5,
  });
  assert(!dup.allow && dup.reason === "duplicate", "duplicate suppressed");
  const next = acceptInteractiveCapturePayload(policy, IMG_B, "question", {
    now: 1000 + INTERACTIVE_CAPTURE_MIN_INTERVAL_MS + 5,
  });
  assert(next.allow, "different frame allowed");
}

// --- Empty payload rejected; prior image preserved ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, IMG_A, "manual");
  const before = state.latestImageBase64;
  state = applyInteractiveCapture(state, "", "question");
  assert(state.latestImageBase64 === before, "empty does not replace");
  assert(!isValidCapturePayload(""), "empty invalid");
  const failed = preserveInteractiveOnCaptureFailure(state);
  assert(failed.latestImageBase64 === IMG_A, "failure preserves");
  assert(failed.taskSession?.id, "session preserved");
}

// --- Capture reasons recorded on frames ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, IMG_A, "activation");
  assert(state.taskSession?.lastFrames[0]?.reason === "activation", "activation reason");
  state = applyInteractiveCapture(state, IMG_B, "answer_complete");
  assert(state.taskSession?.lastFrames[0]?.reason === "answer_complete", "answer_complete reason");
  assert(state.taskSession?.lastFrames[0]?.hash === hashImageFingerprint(IMG_B), "hash meta");
  assert(!JSON.stringify(state.taskSession).includes(IMG_B), "no raw image in session");
}

// --- Solve still fuses latest valid screen; refresh ≠ AI ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, IMG_A, "manual");
  const req = buildInteractiveSolveRequest({
    questionText: "Why is this failing?",
    latestImageBase64: state.latestImageBase64,
    attachLatestScreen: true,
    session: state.taskSession,
    source: "voice",
  });
  assert(req.interactiveHandsOn === true, "flag");
  assert(req.imageBase64 === IMG_A, "latest screen");
  assert(req.questionText?.includes("failing"), "question kept");
  // No screenshot still works
  const textOnly = buildInteractiveSolveRequest({
    questionText: "What next?",
    latestImageBase64: null,
    attachLatestScreen: true,
    session: state.taskSession,
    source: "voice",
  });
  assert(textOnly.imageBase64 === undefined, "no forced image");
  assert(textOnly.interactiveHandsOn === true, "still interactive");
}

// --- Lifecycle: enable then disable stops capture ---
{
  let policy = enableInteractiveCapturePolicy();
  assert(decideInteractiveCapture(policy, "manual", Date.now()).allow, "on");
  policy = disableInteractiveCapturePolicy();
  assert(!decideInteractiveCapture(policy, "manual", Date.now()).allow, "off after disable");
}

console.log("interactiveCapture.verify: all checks passed");
