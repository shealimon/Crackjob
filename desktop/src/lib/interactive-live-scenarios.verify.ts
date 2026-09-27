/**
 * Step 8 — Interactive Live scenario validation (pure orchestration / no AI).
 * Run: npx tsx src/lib/interactive-live-scenarios.verify.ts
 */
import {
  acceptInteractiveCapturePayload,
  enableInteractiveCapturePolicy,
  markInteractiveCaptureAccepted,
} from "./interactiveCapture";
import {
  applyInteractiveCapture,
  buildInteractiveSolveRequest,
  buildScreenshotOnlySolveRequest,
  createIdleInteractiveState,
  disableInteractiveHandsOn,
  enableInteractiveHandsOn,
  interactiveSolveBranch,
  preserveInteractiveOnCaptureFailure,
  shouldFuseVoiceWithScreen,
} from "./interactiveOrchestration";
import {
  applyInterviewerQuestionToContext,
  applyInteractiveAnswerToContext,
  buildFormattedTaskContext,
  initializeInteractiveTaskSession,
  updateTaskBriefFromLocalText,
} from "./interactiveTaskContext";
import {
  clearActiveScreenshotController,
  commitActiveScreenshotExternal,
  createActiveScreenshotController,
  flushActiveScreenshotCaptures,
  getActiveScreenshot,
  runActiveScreenshotCapture,
} from "./activeScreenshot";
import { shouldAttachConversationContext } from "./interviewSpeech";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const IMG_A = "a".repeat(48);
const IMG_B = "b".repeat(48);
const IMG_C = "c".repeat(48);

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Mirrors clearSession Live Start Over screenshot reset. */
function simulateLiveStartOverClearScreen(ctrl: ReturnType<typeof createActiveScreenshotController>) {
  clearActiveScreenshotController(ctrl);
}

// --- Hotkey sequences (active screenshot slot) ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_A);
  commitActiveScreenshotExternal(ctrl, IMG_B);
  assert(getActiveScreenshot(ctrl) === IMG_B, "Ctrl+H twice: latest replaces");
}

{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_A);
  simulateLiveStartOverClearScreen(ctrl);
  assert(getActiveScreenshot(ctrl) === null, "Start Over clears active screenshot");
}

{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_A);
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, IMG_A, "manual");
  const followUp = buildInteractiveSolveRequest({
    questionText: "Why line 42?",
    latestImageBase64: getActiveScreenshot(ctrl),
    attachLatestScreen: true,
    session: state.taskSession,
    source: "voice",
  });
  assert(followUp.imageBase64 === IMG_A, "follow-up same screen without new Ctrl+H");
}

{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_A);
  commitActiveScreenshotExternal(ctrl, IMG_C);
  const req = buildInteractiveSolveRequest({
    questionText: "Debug this",
    latestImageBase64: getActiveScreenshot(ctrl),
    attachLatestScreen: true,
    session: enableInteractiveHandsOn(createIdleInteractiveState()).taskSession,
    source: "voice",
  });
  assert(req.imageBase64 === IMG_C, "second Ctrl+H before solve uses newest");
}

// --- Ctrl+Enter priority (voice vs pending screenshot) ---
assert(
  interactiveSolveBranch({
    hasChatDraft: false,
    hasVoiceOrTextQuestion: true,
    hasPendingScreenshot: true,
    hasLatestImage: true,
  }) === "question",
  "audio + pending screen (either order): combine, not screenshot-only",
);
assert(
  interactiveSolveBranch({
    hasChatDraft: false,
    hasVoiceOrTextQuestion: false,
    hasPendingScreenshot: true,
    hasLatestImage: true,
  }) === "screenshot",
  "Ctrl+H then Ctrl+Enter: screenshot-only",
);

{
  const priorShot = "Given an array of integers, return two-sum indices.";
  assert(
    !shouldAttachConversationContext({
      questionText: "How does garbage collection work?",
      priorQuestion: priorShot,
    }),
    "after screenshot answers, a new audio topic must not reuse the old Q&A",
  );
  assert(
    shouldAttachConversationContext({
      questionText: "What's the time complexity?",
      priorQuestion: priorShot,
    }),
    "explicit follow-up after screenshot may reuse the old Q&A",
  );
  assert(
    shouldFuseVoiceWithScreen({
      hasLatestImage: true,
      screenshotPending: true,
      isFollowUp: false,
      lastSolveHadScreen: false,
    }),
    "Ctrl+H then spoken ask combines voice + screen",
  );
  assert(
    shouldFuseVoiceWithScreen({
      hasLatestImage: true,
      screenshotPending: true,
      isFollowUp: false,
      lastSolveHadScreen: false,
    }),
    "audio first then Ctrl+H also fuses (pending capture)",
  );
  assert(
    !shouldFuseVoiceWithScreen({
      hasLatestImage: true,
      screenshotPending: false,
      isFollowUp: false,
      lastSolveHadScreen: true,
    }),
    "new audio after screenshot answers does not reuse the old frame",
  );
  assert(
    shouldFuseVoiceWithScreen({
      hasLatestImage: true,
      screenshotPending: false,
      isFollowUp: true,
      lastSolveHadScreen: true,
    }),
    "follow-up after combine keeps last screen",
  );
}

{
  const shotOnly = buildScreenshotOnlySolveRequest(IMG_A);
  assert(shotOnly.source === "screenshot", "screenshot-only solve uses screenshot source");
  assert(shotOnly.imageBase64 === IMG_A, "screenshot-only solve carries the committed image");
  assert(
    (shotOnly as { interactiveHandsOn?: boolean }).interactiveHandsOn !== true,
    "screenshot-only must not set interactiveHandsOn",
  );
}

// --- Capture failure / duplicate ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, IMG_A, "manual");
  state = applyInteractiveCapture(state, "", "question");
  assert(state.latestImageBase64 === IMG_A, "empty capture preserves prior");
  const kept = preserveInteractiveOnCaptureFailure(state);
  assert(kept.latestImageBase64 === IMG_A, "failure preserves");
}

{
  let policy = enableInteractiveCapturePolicy();
  policy = markInteractiveCaptureAccepted(policy, IMG_A, 1000);
  const dup = acceptInteractiveCapturePayload(policy, IMG_A, "question", {
    now: 5000,
  });
  assert(!dup.allow && dup.reason === "duplicate", "duplicate screenshot suppressed");
}

// --- Race: question prep while capture in flight ---
{
  const ctrl = createActiveScreenshotController();
  const slow = runActiveScreenshotCapture(ctrl, async () => {
    await delay(25);
    return { imageBase64: IMG_A };
  });
  const fast = runActiveScreenshotCapture(ctrl, async () => {
    await delay(3);
    return { imageBase64: IMG_B };
  });
  await flushActiveScreenshotCaptures(ctrl);
  await Promise.all([slow, fast]);
  assert(getActiveScreenshot(ctrl) === IMG_B, "in-flight: newer capture wins for solve");
}

// --- Lifecycle: Stop / Interactive OFF clears image ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, IMG_A, "manual");
  state = disableInteractiveHandsOn();
  assert(state.latestImageBase64 === null, "Interactive OFF clears image slot");
  assert(state.taskSession === null, "Interactive OFF clears TaskSession");
}

// --- TaskSession: continuity without image bytes ---
{
  let session = initializeInteractiveTaskSession();
  session = applyInterviewerQuestionToContext(session, "Implement user API with idempotency.");
  session = applyInteractiveAnswerToContext(session, "Implement user API", "- I'd use PUT with idempotency keys.");
  const ctx = buildFormattedTaskContext(session)!;
  assert(ctx.includes("CURRENT TASK"), "task brief in context");
  assert(!ctx.includes(IMG_A), "TaskSession has no base64");
  assert(!JSON.stringify(session).includes(IMG_A), "session JSON has no image bytes");
}

// --- Task switching: stale brief kept; current instruction in solve payload ---
{
  let session = initializeInteractiveTaskSession();
  session = applyInterviewerQuestionToContext(session, "Design a rate limiter for the public API.");
  const brief1 = session.taskBrief!;
  session = updateTaskBriefFromLocalText(session, "Write binary search on a sorted array.");
  assert(session.taskBrief === brief1, "unrelated new ask does not replace brief locally");
  const req = buildInteractiveSolveRequest({
    questionText: "Write binary search on a sorted array.",
    latestImageBase64: null,
    attachLatestScreen: false,
    session,
    source: "voice",
  });
  assert(req.questionText?.includes("binary search"), "current instruction is authoritative in API");
}

// Evidence priority P1–P5 in user text: covered by website interactive-prompt.verify (T14).

// --- Domain-agnostic: no mode routing in Interactive solve payload ---
{
  const req = buildInteractiveSolveRequest({
    questionText: "SELECT top 10 products by revenue",
    latestImageBase64: IMG_A,
    attachLatestScreen: true,
    session: initializeInteractiveTaskSession(),
    source: "voice",
  });
  assert(req.interactiveHandsOn === true, "interactive flag only");
  assert(!req.taskContext?.includes("InterviewModeId"), "no domain enum in payload");
}

// --- Unified session engine (Start Interview enables Interactive automatically) ---
{
  let cleared = disableInteractiveHandsOn();
  assert(!cleared.taskSession && !cleared.interactiveHandsOn, "pre-start: idle");
  const unified = enableInteractiveHandsOn(createIdleInteractiveState());
  assert(unified.interactiveHandsOn === true, "unified: interactive flag");
  assert(Boolean(unified.taskSession?.id), "unified: TaskSession initialized");
  const req = buildInteractiveSolveRequest({
    questionText: "Explain this API error",
    latestImageBase64: IMG_A,
    attachLatestScreen: true,
    session: unified.taskSession,
    source: "voice",
  });
  assert(req.interactiveHandsOn === true && req.imageBase64 === IMG_A, "unified: API payload");
}

console.log("interactive-live-scenarios.verify: all checks passed");
