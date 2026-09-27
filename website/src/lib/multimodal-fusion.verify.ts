/**
 * Multimodal fusion tests for assembleSolveUserText / buildStreamUserContent.
 * Run: npx tsx src/lib/multimodal-fusion.verify.ts
 */
import {
  assembleSolveUserText,
  buildStreamUserContent,
  type SolveOptions,
} from "./ai";
import { analyzeStreamRequestSchema } from "./analyze-contract";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Minimal JPEG (1×1) — valid magic bytes; skips sharp when ≤350KB. */
const TINY_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z";

function baseOptions(partial: Partial<SolveOptions> = {}): SolveOptions {
  return {
    mode: "dsa",
    ...partial,
  };
}

function textOf(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === "string") return content;
  const block = content.find((part) => part.type === "text");
  assert(block?.text, "expected a text part");
  return block.text;
}

function hasImagePart(content: string | Array<{ type: string }>): boolean {
  return Array.isArray(content) && content.some((part) => part.type === "image_url");
}

// --- Test 1: text only ---
{
  const text = assembleSolveUserText(
    baseOptions({ questionText: "What is a closure?" }),
  );
  assert(text.includes("Question:\nWhat is a closure?"), "T1: question included");
  assert(!text.includes("CURRENT SCREEN"), "T1: no screen note without image");
  assert(!text.includes("CURRENT TASK CONTEXT"), "T1: no empty task context");
}

// --- Test 2: image only ---
{
  const text = assembleSolveUserText(
    baseOptions({ imageBase64: TINY_JPEG_BASE64, mimeType: "image/jpeg" }),
  );
  assert(
    text.includes("Answer the on-screen interview question"),
    "T2: screenshot instruction preserved",
  );
  assert(!text.includes("INTERVIEWER / CANDIDATE INSTRUCTION"), "T2: no empty instruction");
}

// --- Test 3: text + image ---
{
  const text = assembleSolveUserText(
    baseOptions({
      questionText: "This test is failing. Can you fix it?",
      imageBase64: TINY_JPEG_BASE64,
    }),
  );
  assert(
    text.includes("INTERVIEWER / CANDIDATE INSTRUCTION:\nThis test is failing. Can you fix it?"),
    "T3: instruction kept",
  );
  assert(text.includes("CURRENT SCREEN:"), "T3: screen role present");
  assert(
    !text.includes("Answer the on-screen interview question (editor/IDE/doc/coding site)"),
    "T3: fused path uses CURRENT SCREEN note, not screenshot-only instruction alone",
  );
}

// --- Test 4: text + taskContext ---
{
  const text = assembleSolveUserText(
    baseOptions({
      questionText: "What should I do next?",
      taskContext: "TASK BRIEF: Fix the red CI test",
    }),
  );
  assert(text.includes("Question:\nWhat should I do next?"), "T4: question included");
  assert(
    text.includes("CURRENT TASK CONTEXT:\nTASK BRIEF: Fix the red CI test"),
    "T4: task context included",
  );
}

// --- Test 5: image + taskContext ---
{
  const text = assembleSolveUserText(
    baseOptions({
      imageBase64: TINY_JPEG_BASE64,
      taskContext: "ENVIRONMENT: test runner panel",
    }),
  );
  assert(text.includes("CURRENT TASK CONTEXT:\nENVIRONMENT: test runner panel"), "T5: task");
  assert(text.includes("Answer the on-screen interview question"), "T5: screenshot instruction");
}

// --- Test 6: text + image + taskContext ---
{
  const text = assembleSolveUserText(
    baseOptions({
      questionText: "Why is this test failing?",
      imageBase64: TINY_JPEG_BASE64,
      taskContext: "PROGRESS: opened failing suite",
    }),
  );
  assert(text.includes("INTERVIEWER / CANDIDATE INSTRUCTION:\nWhy is this test failing?"), "T6: q");
  assert(text.includes("CURRENT TASK CONTEXT:\nPROGRESS: opened failing suite"), "T6: task");
  assert(text.includes("CURRENT SCREEN:"), "T6: screen");
}

// --- Test 7: text + image + taskContext + documentContext ---
{
  const text = assembleSolveUserText(
    baseOptions({
      questionText: "Implement the endpoint from the spec",
      imageBase64: TINY_JPEG_BASE64,
      taskContext: "ENVIRONMENT: IDE + browser",
      documentContext: "POST /v1/orders must return 201",
      documentName: "api-spec.pdf",
    }),
  );
  assert(text.includes("INTERVIEWER / CANDIDATE INSTRUCTION:"), "T7: instruction");
  assert(text.includes("CURRENT TASK CONTEXT:"), "T7: task");
  assert(text.includes("ATTACHED DOCUMENT (api-spec.pdf):"), "T7: document");
  assert(text.includes("POST /v1/orders must return 201"), "T7: document body");
  assert(text.includes("CURRENT SCREEN:"), "T7: screen");
}

// --- Test 8: screenshot-only schema + content still valid ---
{
  const parsed = analyzeStreamRequestSchema.safeParse({
    mode: "dsa",
    imageBase64: TINY_JPEG_BASE64,
    mimeType: "image/jpeg",
    source: "screenshot",
  });
  assert(parsed.success, "T8: screenshot-only request schema ok");
  const text = assembleSolveUserText(
    baseOptions({ imageBase64: TINY_JPEG_BASE64, mimeType: "image/jpeg" }),
  );
  assert(text.includes("Answer the on-screen interview question"), "T8: content");
}

// --- Test 9: text-only schema + content still valid ---
{
  const parsed = analyzeStreamRequestSchema.safeParse({
    mode: "fundamentals",
    questionText: "Explain CAP theorem",
    source: "voice",
  });
  assert(parsed.success, "T9: voice/text request schema ok");
  const text = assembleSolveUserText(
    baseOptions({ questionText: "Explain CAP theorem" }),
  );
  assert(text.includes("Question:\nExplain CAP theorem"), "T9: content");
}

// --- Test 10: interactiveHandsOn applies evidence-priority ordering (domain-agnostic) ---
{
  const without = assembleSolveUserText(
    baseOptions({
      questionText: "Debug this",
      imageBase64: TINY_JPEG_BASE64,
      taskContext: "hint",
      interactiveHandsOn: false,
    }),
  );
  const withFlag = assembleSolveUserText(
    baseOptions({
      questionText: "Debug this",
      imageBase64: TINY_JPEG_BASE64,
      taskContext: "hint",
      interactiveHandsOn: true,
    }),
  );
  assert(without !== withFlag, "T10: Interactive uses evidence-priority assembly");
  assert(withFlag.includes("priority 1"), "T10: Interactive marks instruction priority");
  assert(withFlag.includes("INTERACTIVE CONTINUITY CONTEXT"), "T10: continuity label");
  assert(!withFlag.toLowerCase().includes("sql ai"), "T10: no domain pipeline labels");
  assert(!withFlag.toLowerCase().includes("devops ai"), "T10: no domain pipeline labels");

  // Non-Interactive fusion path remains stable
  assert(without.includes("INTERVIEWER / CANDIDATE INSTRUCTION:\nDebug this"), "T10: non-int instruction");
  assert(without.includes("CURRENT TASK CONTEXT:\nhint"), "T10: non-int task label");
}

// --- Async: real multimodal structure includes image_url ---
async function runAsyncFusionChecks() {
  const fused = await buildStreamUserContent(
    baseOptions({
      questionText: "Why is this test failing?",
      imageBase64: TINY_JPEG_BASE64,
      mimeType: "image/jpeg",
      taskContext: "TASK BRIEF: fix failing test",
    }),
  );
  assert(Array.isArray(fused), "async fused content is multimodal array");
  assert(hasImagePart(fused), "async: image_url part present");
  const fusedText = textOf(fused);
  assert(fusedText.includes("INTERVIEWER / CANDIDATE INSTRUCTION:"), "async: instruction");
  assert(fusedText.includes("CURRENT TASK CONTEXT:"), "async: task");
  assert(fusedText.includes("CURRENT SCREEN:"), "async: screen");

  const interactiveFused = await buildStreamUserContent(
    baseOptions({
      interactiveHandsOn: true,
      questionText: "Why is this test failing?",
      imageBase64: TINY_JPEG_BASE64,
      mimeType: "image/jpeg",
      taskContext: "TASK BRIEF: fix failing test",
      documentContext: "assert status == 200",
      documentName: "notes.md",
    }),
  );
  assert(hasImagePart(interactiveFused), "async interactive: image present");
  const iText = textOf(interactiveFused);
  assert(iText.includes("priority 1"), "async interactive: P1");
  assert(iText.includes("INTERACTIVE CONTINUITY CONTEXT"), "async interactive: P4");
  assert(iText.includes("ATTACHED DOCUMENT (notes.md)"), "async interactive: document");
  const iQ = iText.indexOf("INTERVIEWER / CANDIDATE INSTRUCTION");
  const iScreen = iText.indexOf("CURRENT SCREEN (priority 2");
  const iDoc = iText.indexOf("ATTACHED DOCUMENT");
  const iTask = iText.indexOf("INTERACTIVE CONTINUITY CONTEXT");
  assert(iQ >= 0 && iScreen > iQ && iDoc > iScreen && iTask > iDoc, "async interactive: order");

  const textOnly = await buildStreamUserContent(
    baseOptions({ questionText: "What is a mutex?" }),
  );
  assert(typeof textOnly === "string", "async text-only remains a string");
  assert(!hasImagePart(textOnly), "async text-only has no image");

  const shotOnly = await buildStreamUserContent(
    baseOptions({ imageBase64: TINY_JPEG_BASE64, mimeType: "image/jpeg" }),
  );
  assert(hasImagePart(shotOnly), "async screenshot-only has image");
  assert(
    textOf(shotOnly).includes("Answer the on-screen interview question"),
    "async screenshot-only instruction",
  );
}

runAsyncFusionChecks()
  .then(() => {
    console.log("multimodal-fusion.verify: all checks passed");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
