/**
 * Active screenshot slot regression tests (Interactive Live Ctrl+H / Ctrl+Enter).
 * Run: npx tsx src/lib/activeScreenshot.verify.ts
 */
import {
  buildInteractiveSolveRequest,
  createIdleInteractiveState,
  disableInteractiveHandsOn,
  enableInteractiveHandsOn,
  applyInteractiveCapture,
} from "./interactiveOrchestration";
import {
  abortRustCaptureInFlight,
  adoptRustSolveScreenshotIfNeeded,
  beginRustCaptureInFlight,
  clearActiveScreenshotController,
  commitActiveScreenshot,
  commitActiveScreenshotExternal,
  completeRustCaptureInFlight,
  createActiveScreenshotController,
  flushActiveScreenshotCaptures,
  getActiveScreenshot,
  getCommittedScreenshotGeneration,
  invalidateActiveScreenshotSession,
  resolveLatestCommittedScreenshot,
  runActiveScreenshotCapture,
} from "./activeScreenshot";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const IMG_Q1 = "a".repeat(48);
const IMG_Q2 = "b".repeat(48);
const IMG_Q3 = "c".repeat(48);

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function attachScreenForVoice(slot: string | null) {
  return Boolean(slot);
}

// --- Session reset clears active screenshot ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);
  assert(getActiveScreenshot(ctrl) === IMG_Q1, "reset: has image");
  clearActiveScreenshotController(ctrl);
  assert(getActiveScreenshot(ctrl) === null, "reset: cleared");
  const off = disableInteractiveHandsOn();
  assert(off.latestImageBase64 === null, "reset: orchestration idle");
}

// --- New Ctrl+H replaces old active screenshot ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);
  commitActiveScreenshotExternal(ctrl, IMG_Q2);
  assert(getActiveScreenshot(ctrl) === IMG_Q2, "replace: latest wins");
}

// --- Follow-up without new capture keeps same active image ---
{
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, IMG_Q1, "manual");
  const followUp = buildInteractiveSolveRequest({
    questionText: "What about line 42?",
    latestImageBase64: state.latestImageBase64,
    attachLatestScreen: true,
    session: state.taskSession,
    source: "voice",
  });
  assert(followUp.imageBase64 === IMG_Q1, "follow-up: same screen");
}

// --- Screen-first flow: capture then voice solve uses that frame ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q2);
  let state = enableInteractiveHandsOn(createIdleInteractiveState());
  state = applyInteractiveCapture(state, getActiveScreenshot(ctrl)!, "manual");
  const { imageBase64 } = await resolveLatestCommittedScreenshot(ctrl);
  assert(imageBase64 === IMG_Q2, "screen-first: slot at solve time");
  assert(
    attachScreenForVoice(imageBase64) &&
      buildInteractiveSolveRequest({
        questionText: "Why does this test fail?",
        latestImageBase64: imageBase64,
        attachLatestScreen: true,
        session: state.taskSession,
        source: "voice",
      }).imageBase64 === IMG_Q2,
    "screen-first: fused image",
  );
}

// --- Ctrl+H → Audio → Ctrl+Enter uses latest committed screen ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);
  beginRustCaptureInFlight(ctrl);
  completeRustCaptureInFlight(ctrl, IMG_Q2);
  const { imageBase64 } = await resolveLatestCommittedScreenshot(ctrl);
  assert(imageBase64 === IMG_Q2, "audio+screen: latest after Ctrl+H");
  assert(
    buildInteractiveSolveRequest({
      questionText: "Explain the error on screen",
      latestImageBase64: imageBase64,
      attachLatestScreen: attachScreenForVoice(imageBase64),
      session: enableInteractiveHandsOn(createIdleInteractiveState()).taskSession,
      source: "voice",
    }).imageBase64 === IMG_Q2,
    "audio+screen: not Q1",
  );
}

// --- Race: late stale completion cannot overwrite newer active screenshot ---
{
  const ctrl = createActiveScreenshotController();
  const slow = runActiveScreenshotCapture(ctrl, async () => {
    await delay(30);
    return { imageBase64: IMG_Q1 };
  });
  const fast = runActiveScreenshotCapture(ctrl, async () => {
    await delay(5);
    return { imageBase64: IMG_Q2 };
  });
  await flushActiveScreenshotCaptures(ctrl);
  await Promise.all([slow, fast]);
  assert(getActiveScreenshot(ctrl) === IMG_Q2, "race: newer frame kept");

  const stale = commitActiveScreenshot(ctrl, 1, IMG_Q1);
  assert(!stale, "race: stale gen rejected");
}

// --- Ctrl+H → immediate Ctrl+Enter: flush waits for in-flight Rust capture ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);

  beginRustCaptureInFlight(ctrl);
  let flushDone = false;
  const flushPromise = flushActiveScreenshotCaptures(ctrl).then(() => {
    flushDone = true;
  });
  await Promise.resolve();
  assert(!flushDone, "immediate solve: flush blocked until capture-ready");

  completeRustCaptureInFlight(ctrl, IMG_Q2);
  await flushPromise;
  assert(getActiveScreenshot(ctrl) === IMG_Q2, "immediate solve: newest frame");
}

// --- Delayed JS capture: Ctrl+Enter waits then uses new frame ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);
  const capture = runActiveScreenshotCapture(ctrl, async () => {
    await delay(25);
    return { imageBase64: IMG_Q3 };
  });
  const resolved = resolveLatestCommittedScreenshot(ctrl);
  await delay(5);
  assert(getActiveScreenshot(ctrl) === IMG_Q1, "delayed: still old until done");
  await capture;
  const { imageBase64 } = await resolved;
  assert(imageBase64 === IMG_Q3, "delayed: new frame after capture completes");
}

// --- Capture failure does not replace prior screenshot ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_A_SHORT());
  const failed = runActiveScreenshotCapture(ctrl, async () => null);
  await failed;
  assert(getActiveScreenshot(ctrl) === IMG_A_SHORT(), "failure: prior kept");
}

function IMG_A_SHORT() {
  return IMG_Q1;
}

// --- Start Over during capture: late frame ignored ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);
  const gen = beginRustCaptureInFlight(ctrl);
  invalidateActiveScreenshotSession(ctrl);
  const accepted = commitActiveScreenshot(ctrl, gen, IMG_Q2);
  assert(!accepted, "start over: late commit rejected");
  assert(getActiveScreenshot(ctrl) === null, "start over: slot empty");
  abortRustCaptureInFlight(ctrl);
}

// --- Stop → Start Interview: fresh session accepts only new captures ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);
  invalidateActiveScreenshotSession(ctrl);
  beginRustCaptureInFlight(ctrl);
  const { accepted } = completeRustCaptureInFlight(ctrl, IMG_Q2);
  assert(accepted, "restart: new capture after invalidate");
  assert(getActiveScreenshot(ctrl) === IMG_Q2, "restart: new image");
}

// --- adoptRustSolveScreenshotIfNeeded only fills empty slot ---
{
  const ctrl = createActiveScreenshotController();
  assert(
    adoptRustSolveScreenshotIfNeeded(ctrl, IMG_Q1),
    "adopt: fills empty",
  );
  assert(
    !adoptRustSolveScreenshotIfNeeded(ctrl, IMG_Q2),
    "adopt: does not overwrite committed",
  );
  assert(getActiveScreenshot(ctrl) === IMG_Q1, "adopt: keeps first");
}

// --- Reserved rust generation pairs started/ready ---
{
  const ctrl = createActiveScreenshotController();
  const startedGen = beginRustCaptureInFlight(ctrl);
  const { generation, accepted } = completeRustCaptureInFlight(ctrl, IMG_Q2);
  assert(accepted, "rust pair: accepted");
  assert(generation === startedGen, "rust pair: same generation");
  assert(
    getCommittedScreenshotGeneration(ctrl) === startedGen,
    "rust pair: committed gen",
  );
}

// --- T1: Ctrl+H → immediate Ctrl+Enter uses NEW frame (Rust path) ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);
  beginRustCaptureInFlight(ctrl);
  const solvePromise = resolveLatestCommittedScreenshot(ctrl);
  completeRustCaptureInFlight(ctrl, IMG_Q2);
  const { imageBase64 } = await solvePromise;
  assert(imageBase64 === IMG_Q2, "T1: immediate solve gets new screenshot");
}

// --- T2: Ctrl+G clears slot — Ctrl+Enter has no committed screenshot ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);
  invalidateActiveScreenshotSession(ctrl);
  const { imageBase64 } = await resolveLatestCommittedScreenshot(ctrl);
  assert(imageBase64 === null, "T2: cleared slot after invalidate");
}

// --- T3: Ctrl+H A → Ctrl+H B → immediate Ctrl+Enter → B only ---
{
  const ctrl = createActiveScreenshotController();
  beginRustCaptureInFlight(ctrl);
  completeRustCaptureInFlight(ctrl, IMG_Q1);
  beginRustCaptureInFlight(ctrl);
  const solvePromise = resolveLatestCommittedScreenshot(ctrl);
  completeRustCaptureInFlight(ctrl, IMG_Q2);
  const { imageBase64 } = await solvePromise;
  assert(imageBase64 === IMG_Q2, "T3: second capture wins for solve");
}

// --- T4: stale dedupe capture-ready during in-flight capture cannot restore old frame ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);
  beginRustCaptureInFlight(ctrl);
  const stale = completeRustCaptureInFlight(ctrl, IMG_Q1);
  assert(!stale.accepted, "T4: stale dedupe ready rejected");
  assert(getActiveScreenshot(ctrl) === IMG_Q1, "T4: slot unchanged until real ready");
  completeRustCaptureInFlight(ctrl, IMG_Q2);
  assert(getActiveScreenshot(ctrl) === IMG_Q2, "T4: real capture commits B");
}

// --- Same-frame recapture must not block Ctrl+Enter forever ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);
  beginRustCaptureInFlight(ctrl);
  completeRustCaptureInFlight(ctrl, IMG_Q1);
  const { imageBase64 } = await resolveLatestCommittedScreenshot(ctrl);
  assert(imageBase64 === IMG_Q1, "same-frame: flush unblocks with existing screenshot");
}

// --- T5: Start Interview invalidate → new Ctrl+H is authoritative ---
{
  const ctrl = createActiveScreenshotController();
  commitActiveScreenshotExternal(ctrl, IMG_Q1);
  invalidateActiveScreenshotSession(ctrl);
  beginRustCaptureInFlight(ctrl);
  completeRustCaptureInFlight(ctrl, IMG_Q2);
  const { imageBase64 } = await resolveLatestCommittedScreenshot(ctrl);
  assert(imageBase64 === IMG_Q2, "T5: post-start capture only");
}

// --- Double capture-started, single capture-ready unblocks flush ---
{
  const ctrl = createActiveScreenshotController();
  beginRustCaptureInFlight(ctrl);
  beginRustCaptureInFlight(ctrl);
  let flushDone = false;
  const flushPromise = flushActiveScreenshotCaptures(ctrl).then(() => {
    flushDone = true;
  });
  await Promise.resolve();
  assert(!flushDone, "double started: flush blocked until ready");
  completeRustCaptureInFlight(ctrl, IMG_Q2);
  await flushPromise;
  assert(flushDone, "double started: flush released");
  assert(getActiveScreenshot(ctrl) === IMG_Q2, "double started: latest frame");
}

console.log("activeScreenshot.verify: all checks passed");
