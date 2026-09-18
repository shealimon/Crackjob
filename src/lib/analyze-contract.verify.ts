/**
 * Contract verification for Interactive / Hands-on analyze request schema.
 * Run: npx tsx src/lib/analyze-contract.verify.ts
 */
import {
  analyzeStreamRequestSchema,
  ANALYZE_TASK_CONTEXT_MAX_CHARS,
} from "./analyze-contract";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectOk(label: string, data: unknown) {
  const result = analyzeStreamRequestSchema.safeParse(data);
  assert(result.success, `${label}: expected ok, got ${JSON.stringify(result.error?.issues)}`);
}

function expectFail(label: string, data: unknown) {
  const result = analyzeStreamRequestSchema.safeParse(data);
  assert(!result.success, `${label}: expected failure`);
}

// 1. Existing text request
expectOk("text-only", {
  mode: "dsa",
  questionText: "What is a closure?",
  source: "text",
});

// 2. Existing screenshot request
expectOk("screenshot-only", {
  mode: "dsa",
  imageBase64: "a".repeat(24),
  mimeType: "image/jpeg",
  source: "screenshot",
});

// 3. Existing voice request
expectOk("voice-only", {
  mode: "fundamentals",
  questionText: "Explain CAP theorem",
  source: "voice",
});

// 4. Fused Interactive request: questionText + image + taskContext
expectOk("interactive-fused", {
  mode: "project",
  questionText: "Why is this test failing?",
  imageBase64: "b".repeat(24),
  mimeType: "image/jpeg",
  source: "text",
  interactiveHandsOn: true,
  taskContext: [
    "TASK BRIEF: Investigate the failing CI test on the shared dashboard.",
    "ENVIRONMENT: browser test results page",
    "ARTIFACTS: red failing assertion on auth callback",
    "PROGRESS: reproduced locally once",
    "RECENT GUIDANCE: check redirect URI mismatch",
  ].join("\n"),
});

// Backward compat: omit new fields
expectOk("omit-interactive-fields", {
  mode: "lld",
  questionText: "Design a rate limiter",
});

// Reject empty payload
expectFail("empty-payload", { mode: "dsa" });

// Reject oversized taskContext
expectFail("taskContext-too-large", {
  mode: "dsa",
  questionText: "debug this",
  taskContext: "x".repeat(ANALYZE_TASK_CONTEXT_MAX_CHARS + 1),
});

// Reject unknown InterviewModeId (Interactive must not become a mode)
expectFail("interactive-as-mode", {
  mode: "interactive",
  questionText: "do the hands-on task",
});

console.log("analyze-contract.verify: all checks passed");
