/**
 * Desktop Interactive / Hands-on orchestration contract tests (Step 4).
 * Run: npx tsx src/lib/interactiveOrchestration.verify.ts
 */
import {
  applyInteractiveCapture,
  applyInteractiveSolveSuccess,
  buildInteractiveSolveRequest,
  buildScreenshotOnlySolveRequest,
  createIdleInteractiveState,
  disableInteractiveHandsOn,
  enableInteractiveHandsOn,
  interactiveSolveBranch,
  preserveInteractiveOnCaptureFailure,
  shouldFuseVoiceWithScreen,
} from "./interactiveOrchestration";
import { formatTaskContext, isInteractiveHandsOnActive } from "./taskSession";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const FAKE_JPEG = "a".repeat(48);

// --- Test 1: Interactive OFF — fused Interactive fields absent ---
{
  const idle = createIdleInteractiveState();
  assert(idle.interactiveHandsOn === false, "T1: off");
  assert(idle.taskSession === null, "T1: no session");
  const branch = interactiveSolveBranch({
    hasChatDraft: false,
    hasVoiceOrTextQuestion: true,
    hasPendingScreenshot: true,
    hasLatestImage: true,
  });
  // Branch helper is only consulted when Interactive ON; off path uses legacy order.
  assert(branch === "question", "T1: helper prefers question when both exist");
}

// --- Test 2: Interactive ON creates TaskSession ---
{
  const on = enableInteractiveHandsOn(createIdleInteractiveState());
  assert(on.interactiveHandsOn === true, "T2: on");
  assert(isInteractiveHandsOnActive(on.taskSession), "T2: session created");
}

// --- Test 3: Ctrl+H updates screen context; no AI fields required ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, FAKE_JPEG, "manual");
  assert(state.latestImageBase64 === FAKE_JPEG, "T3: image held transiently");
  assert(state.screenshotPending === true, "T3: pending for Ctrl+Enter");
  assert(state.taskSession?.lastFrames[0]?.hash, "T3: frame metadata recorded");
  assert(
    !("imageBase64" in (state.taskSession || {})),
    "T3: TaskSession has no imageBase64",
  );
  assert(
    !JSON.stringify(state.taskSession).includes(FAKE_JPEG),
    "T3: base64 not stored in TaskSession JSON",
  );
}

// --- Test 3b: activation refresh — context only, not “press Ctrl+Enter” pending ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, FAKE_JPEG, "activation");
  assert(state.latestImageBase64 === FAKE_JPEG, "T3b: activation capture held");
  assert(state.screenshotPending === false, "T3b: activation not pending");
}

// --- Test 4: voice + screen fused request ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, FAKE_JPEG);
  const req = buildInteractiveSolveRequest({
    questionText: "Why is this request failing?",
    latestImageBase64: state.latestImageBase64,
    attachLatestScreen: true,
    session: state.taskSession,
    source: "voice",
  });
  assert(req.questionText === "Why is this request failing?", "T4: question");
  assert(req.imageBase64 === FAKE_JPEG, "T4: image");
  assert(req.interactiveHandsOn === true, "T4: flag");
  assert(typeof req.taskContext === "string" || req.taskContext === undefined, "T4: taskContext");
}

// --- Test 5: text + screen fused request ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, FAKE_JPEG);
  const req = buildInteractiveSolveRequest({
    questionText: "Why is this test failing?",
    latestImageBase64: state.latestImageBase64,
    attachLatestScreen: true,
    session: state.taskSession,
    source: "text",
  });
  assert(req.source === "text", "T5: text source");
  assert(req.imageBase64 === FAKE_JPEG, "T5: image");
  assert(req.interactiveHandsOn === true, "T5: flag");
}

// --- Test 6: question without screenshot still works ---
{
  const state = enableInteractiveHandsOn(createIdleInteractiveState());
  const req = buildInteractiveSolveRequest({
    questionText: "What should I check first?",
    latestImageBase64: null,
    attachLatestScreen: true,
    session: state.taskSession,
    source: "voice",
  });
  assert(req.questionText, "T6: question");
  assert(req.imageBase64 === undefined, "T6: no image forced");
  assert(req.interactiveHandsOn === true, "T6: flag");
}

// --- Test 7: disable clears session + image ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, FAKE_JPEG);
  state = disableInteractiveHandsOn();
  assert(state.interactiveHandsOn === false, "T7: off");
  assert(state.taskSession === null, "T7: session cleared");
  assert(state.latestImageBase64 === null, "T7: image cleared");
  assert(state.screenshotPending === false, "T7: pending cleared");
}

// --- Test 8 / 9: Stop / Start Over = disableInteractiveHandsOn ---
{
  const cleared = disableInteractiveHandsOn();
  assert(cleared.interactiveHandsOn === false && cleared.taskSession === null, "T8/T9: cleared");
}

// --- Test 10: capture failure preserves state ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, FAKE_JPEG);
  const kept = preserveInteractiveOnCaptureFailure(state);
  assert(kept.interactiveHandsOn === true, "T10: still on");
  assert(kept.latestImageBase64 === FAKE_JPEG, "T10: prior image kept");
  assert(kept.taskSession?.lastFrames.length === 1, "T10: frame kept");
}

// Priority: Interactive question beats pending screenshot
assert(
  interactiveSolveBranch({
    hasChatDraft: false,
    hasVoiceOrTextQuestion: true,
    hasPendingScreenshot: true,
    hasLatestImage: true,
  }) === "question",
  "audio then screenshot OR screenshot then audio: combine via question path",
);
assert(
  interactiveSolveBranch({
    hasChatDraft: true,
    hasVoiceOrTextQuestion: true,
    hasPendingScreenshot: true,
    hasLatestImage: true,
  }) === "chat",
  "priority: chat first",
);
assert(
  interactiveSolveBranch({
    hasChatDraft: false,
    hasVoiceOrTextQuestion: false,
    hasPendingScreenshot: true,
    hasLatestImage: true,
  }) === "screenshot",
  "priority: screenshot-only when no question",
);

assert(
  shouldFuseVoiceWithScreen({
    hasLatestImage: true,
    screenshotPending: true,
    isFollowUp: false,
    lastSolveHadScreen: false,
  }),
  "Ctrl+H + spoken ask fuses screen",
);
assert(
  shouldFuseVoiceWithScreen({
    hasLatestImage: true,
    screenshotPending: false,
    isFollowUp: true,
    lastSolveHadScreen: true,
  }),
  "follow-up after screen answer keeps last frame",
);
assert(
  !shouldFuseVoiceWithScreen({
    hasLatestImage: true,
    screenshotPending: false,
    isFollowUp: false,
    lastSolveHadScreen: true,
  }),
  "new independent audio must not hitch leftover screenshot",
);
assert(
  !shouldFuseVoiceWithScreen({
    hasLatestImage: true,
    screenshotPending: false,
    isFollowUp: true,
    lastSolveHadScreen: false,
  }),
  "voice follow-up after a voice-only answer does not attach an old screen",
);
assert(
  !shouldFuseVoiceWithScreen({
    hasLatestImage: false,
    screenshotPending: true,
    isFollowUp: false,
    lastSolveHadScreen: false,
  }),
  "no image → no fuse",
);

{
  const shotOnly = buildScreenshotOnlySolveRequest(FAKE_JPEG);
  assert(shotOnly.source === "screenshot", "screenshot-only: source");
  assert(shotOnly.imageBase64 === FAKE_JPEG, "screenshot-only: image attached");
  assert(
    !("interactiveHandsOn" in shotOnly) ||
      (shotOnly as { interactiveHandsOn?: boolean }).interactiveHandsOn !== true,
    "screenshot-only: must not use Interactive clarification prompt",
  );
  assert(
    !("taskContext" in shotOnly),
    "screenshot-only: no TaskSession wrap",
  );
  const interactiveShot = buildInteractiveSolveRequest({
    latestImageBase64: FAKE_JPEG,
    attachLatestScreen: true,
    session: enableInteractiveHandsOn(createIdleInteractiveState()).taskSession,
    source: "screenshot",
  });
  assert(interactiveShot.interactiveHandsOn === true, "interactive builder still sets flag");
}

// Guidance history bounded update
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  assert(state.taskSession, "session");
  state = {
    ...state,
    taskSession: applyInteractiveSolveSuccess(
      state.taskSession!,
      "Fix the failing test",
      "- I'd inspect the assertion and trace the null reference.",
    ),
  };
  assert(state.taskSession?.taskBrief === "Fix the failing test", "brief from question");
  assert(state.taskSession?.guidanceHistory.length === 1, "guidance recorded");
  const ctx = formatTaskContext(state.taskSession);
  assert(ctx?.includes("CURRENT TASK"), "taskContext includes brief");
  assert(ctx?.includes("RECENT GUIDANCE"), "taskContext includes guidance");
  assert(!ctx?.includes(FAKE_JPEG), "taskContext has no image bytes");
}

console.log("interactiveOrchestration.verify: all checks passed");
