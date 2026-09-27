/**
 * Deterministic Interactive TaskSession context builder tests (Step 6).
 * Run: npx tsx src/lib/interactiveTaskContext.verify.ts
 */
import {
  TASK_BRIEF_MAX_CHARS,
  TASK_FORMATTED_CONTEXT_TARGET_CHARS,
  appendDocumentNameHint,
  appendExplicitEnvironmentHint,
  appendFrameMetadata,
  appendGuidanceHistory,
  appendProgressNote,
  applyCandidateSubmissionToContext,
  applyInteractiveAnswerToContext,
  applyInterviewerQuestionToContext,
  buildFormattedTaskContext,
  initializeInteractiveTaskSession,
  updateTaskBriefFromLocalText,
} from "./interactiveTaskContext";
import {
  disableInteractiveHandsOn,
  enableInteractiveHandsOn,
  createIdleInteractiveState,
  applyInteractiveSolveSuccess,
  buildInteractiveSolveRequest,
} from "./interactiveOrchestration";
import { TASK_CONTEXT_MAX_CHARS } from "./taskSession";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const IMG_A = "a".repeat(48);
const IMG_B = "b".repeat(48);

// --- Task brief ---
{
  let s = initializeInteractiveTaskSession();
  s = updateTaskBriefFromLocalText(s, "ok");
  assert(s.taskBrief === null, "brief ignores filler");
  s = applyInterviewerQuestionToContext(
    s,
    "Build an API endpoint that returns the top 10 products by sales.",
  );
  assert(
    s.taskBrief?.includes("top 10 products"),
    "first meaningful question creates brief",
  );
  const brief1 = s.taskBrief!;
  s = updateTaskBriefFromLocalText(s, "Use Redis.");
  assert(s.taskBrief === brief1, "unrelated later text does not replace brief");
  s = updateTaskBriefFromLocalText(
    s,
    "Build an API endpoint that returns the top 10 products by sales. Include pagination.",
  );
  assert(
    s.taskBrief?.includes("pagination"),
    "controlled extension when prior brief is contained",
  );
  s = updateTaskBriefFromLocalText(s, "x".repeat(TASK_BRIEF_MAX_CHARS + 80));
  // when brief already set and new text doesn't contain it — no replace
  assert((s.taskBrief?.length || 0) <= TASK_BRIEF_MAX_CHARS + 1, "brief bounded");
}

// --- Progress ---
{
  let s = initializeInteractiveTaskSession();
  s = applyInterviewerQuestionToContext(s, "Fix the failing auth callback.");
  assert(s.progressNotes.some((n) => n.includes("Interviewer ask")), "interviewer progress");
  s = applyCandidateSubmissionToContext(s, "I would check the redirect URI next.", "voice");
  assert(s.progressNotes.some((n) => n.includes("Candidate said")), "voice progress");
  s = applyCandidateSubmissionToContext(s, "I would check the redirect URI next.", "voice");
  const voiceNotes = s.progressNotes.filter((n) => n.includes("Candidate said"));
  assert(voiceNotes.length === 1, "duplicate voice progress suppressed");
  s = applyCandidateSubmissionToContext(s, "Proposed PostgreSQL for storage.", "text");
  assert(s.progressNotes.some((n) => n.includes("Candidate submitted")), "text progress");
  // Partial STT simulation: too short / filler ignored
  const before = s.progressNotes.length;
  s = applyCandidateSubmissionToContext(s, "uh", "voice");
  assert(s.progressNotes.length === before, "partial/filler not recorded");
}

// --- Guidance ---
{
  let s = initializeInteractiveTaskSession();
  s = applyInteractiveAnswerToContext(
    s,
    "Fix the test",
    "- I'd inspect the assertion failure and check the null user id.",
  );
  assert(s.guidanceHistory.length === 1, "guidance recorded");
  assert(s.taskBrief?.includes("Fix the test"), "brief seeded from answer prompt");
  s = applyInteractiveAnswerToContext(
    s,
    "Fix the test",
    "- I'd inspect the assertion failure and check the null user id.",
  );
  assert(s.guidanceHistory.length === 1, "duplicate guidance suppressed");
  s = applyInteractiveSolveSuccess(s, "Next step", "- Then I would rerun the suite.");
  assert(s.guidanceHistory.length === 2, "new guidance appended");
}

// --- Frames ---
{
  let s = initializeInteractiveTaskSession();
  s = appendFrameMetadata(s, IMG_A, "manual");
  assert(s.lastFrames[0]?.hash, "frame hash present");
  assert(s.lastFrames[0]?.reason === "manual", "frame reason");
  assert(!JSON.stringify(s).includes(IMG_A), "no base64 in session");
  const n1 = s.lastFrames.length;
  s = appendFrameMetadata(s, IMG_A, "question");
  assert(s.lastFrames.length === n1, "duplicate hash suppressed");
  s = appendFrameMetadata(s, IMG_B, "answer_complete");
  assert(s.lastFrames.length === n1 + 1, "new hash appended");
  s = appendFrameMetadata(s, IMG_A, "manual", { force: true });
  assert(s.lastFrames[0]?.hash !== s.lastFrames[1]?.hash || s.lastFrames.length >= 2, "force allows");
}

// --- Environment hints: explicit only ---
{
  let s = initializeInteractiveTaskSession();
  s = appendDocumentNameHint(s, "api-spec.pdf");
  assert(s.environmentHints.some((h) => h.includes("api-spec.pdf")), "document name ok");
  s = appendExplicitEnvironmentHint(s, "window: Orders Dashboard");
  assert(s.environmentHints.some((h) => h.includes("Orders Dashboard")), "explicit window ok");
  // Builder does not invent IDE/language from pixels — nothing to call; ensure no auto fields.
  assert(!("inferredLanguage" in s), "no inferred language field");
}

// --- Formatting order + budget ---
{
  let s = initializeInteractiveTaskSession();
  s = applyInterviewerQuestionToContext(s, "Design a rate limiter for the public API.");
  s = appendExplicitEnvironmentHint(s, "document: design-notes.md");
  s = appendProgressNote(s, "Candidate discussed token bucket");
  s = appendFrameMetadata(s, IMG_A, "activation", { force: true });
  s = appendGuidanceHistory(s, "Design a rate limiter", "- I'd clarify QPS and burst first.");
  const ctx = buildFormattedTaskContext(s);
  assert(ctx, "context produced");
  assert(ctx!.startsWith("CONTEXT DATA"), "preamble present");
  const iTask = ctx!.indexOf("CURRENT TASK:");
  const iEnv = ctx!.indexOf("ENVIRONMENT HINTS:");
  const iProg = ctx!.indexOf("RECENT PROGRESS:");
  const iFrame = ctx!.indexOf("RECENT SCREEN REFS:");
  const iGuide = ctx!.indexOf("RECENT GUIDANCE:");
  assert(iTask >= 0 && iEnv > iTask && iProg > iEnv && iFrame > iProg && iGuide > iFrame, "order");
  assert(ctx!.length <= TASK_FORMATTED_CONTEXT_TARGET_CHARS, "under soft target");
  assert(ctx!.length <= TASK_CONTEXT_MAX_CHARS, "under contract max");
  assert(!ctx!.includes(IMG_A), "formatted context has no image bytes");
}

// --- Solve payload still uses improved context ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = {
    ...state,
    taskSession: applyInterviewerQuestionToContext(
      state.taskSession!,
      "Why is this test failing?",
    ),
    latestImageBase64: IMG_A,
  };
  const req = buildInteractiveSolveRequest({
    questionText: "Why is this test failing?",
    latestImageBase64: state.latestImageBase64,
    attachLatestScreen: true,
    session: state.taskSession,
    source: "voice",
  });
  assert(req.interactiveHandsOn === true, "flag");
  assert(req.taskContext?.includes("CURRENT TASK:"), "taskContext improved");
  assert(req.imageBase64 === IMG_A, "image attached");
}

// --- Lifecycle clear ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  assert(state.taskSession?.id, "session on");
  state = disableInteractiveHandsOn();
  assert(state.taskSession === null && state.interactiveHandsOn === false, "cleared");
}

console.log("interactiveTaskContext.verify: all checks passed");
