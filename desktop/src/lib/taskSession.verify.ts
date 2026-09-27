/**
 * Contract verification for TaskSession / Interactive capability types.
 * Run: npx tsx src/lib/taskSession.verify.ts
 */
import {
  createTaskSession,
  isInteractiveHandsOnActive,
  type TaskContextDraft,
  type TaskFrameRef,
  type TaskSession,
} from "./taskSession";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// 5. Non-coding task representation (no domain enum required)
const nonCoding: TaskSession = createTaskSession({
  taskBrief:
    "Walk through the cloud console and explain why this IAM role cannot assume the target.",
  environmentHints: ["cloud console", "IAM policy viewer", "permissions error banner"],
  visibleArtifacts: [
    {
      id: "a1",
      label: "error",
      summary: "AccessDenied: User is not authorized to perform sts:AssumeRole",
      observedAt: Date.now(),
    },
  ],
  progressNotes: ["Opened the role trust policy", "Compared principal ARN to caller"],
  lastFrames: [
    {
      id: "f1",
      capturedAt: Date.now(),
      hash: "abc123",
      mimeType: "image/jpeg",
      width: 640,
      height: 400,
      localRef: "pending-capture-slot",
    } satisfies TaskFrameRef,
  ],
  guidanceHistory: [
    {
      id: "g1",
      at: Date.now(),
      prompt: "Why can't this role be assumed?",
      guidance: "Check trust policy principal and external ID conditions.",
    },
  ],
});

assert(nonCoding.taskBrief?.includes("IAM"), "non-coding brief should be free-form");
assert(
  !("domain" in nonCoding) && !("category" in nonCoding),
  "TaskSession must not require a predefined domain field",
);

// 6. No predefined domain required — empty brief / arbitrary hints still valid
const openEnded = createTaskSession({
  taskBrief: null,
  environmentHints: ["unknown tooling surface the candidate was given"],
});
assert(openEnded.taskBrief === null, "brief may be null");
assert(isInteractiveHandsOnActive(openEnded), "created session activates capability");
assert(!isInteractiveHandsOnActive(null), "null session is inactive");

// 7. Full image/base64 must not live on TaskSession
const frame = nonCoding.lastFrames[0];
assert(frame, "expected a frame ref");
assert(!("imageBase64" in frame), "frame must not store imageBase64");
assert(!("base64" in frame), "frame must not store base64");
assert(!("imageBase64" in nonCoding), "session must not store imageBase64");

for (const key of Object.keys(nonCoding)) {
  assert(key !== "imageBase64" && key !== "image" && key !== "base64", `forbidden key ${key}`);
}

// AI-facing draft is separate from internal session (contract shape only)
const draft: TaskContextDraft = {
  taskBrief: nonCoding.taskBrief ?? undefined,
  environmentHints: nonCoding.environmentHints,
  visibleArtifacts: nonCoding.visibleArtifacts.map((a) => a.summary),
  progressNotes: nonCoding.progressNotes,
  recentGuidance: nonCoding.guidanceHistory.map((g) => g.guidance),
};
assert(typeof draft.taskBrief === "string", "draft carries brief text");
assert(!("lastFrames" in draft), "AI draft must not include frame binary refs wholesale as session");

console.log("taskSession.verify: all checks passed");
