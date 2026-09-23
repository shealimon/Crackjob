/**
 * Live solve model / token / image-detail routing tests.
 * Run: npx tsx src/lib/solve-routing.verify.ts
 */
import {
  getAnswerImageDetail,
  getAnswerMaxTokens,
  getQualityAnswerMaxTokens,
  getVoiceAnswerMaxTokens,
  isQualitySolvePath,
  isTrivialVoiceFollowUp,
  pickStreamModel,
  type StreamModelConfig,
} from "./solve-routing";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const config: StreamModelConfig = {
  model: "gpt-6-luna",
  fastModel: "gpt-4.1-mini",
  nanoModel: "gpt-4.1-nano",
};

// Voice-only → speed model
{
  assert(!isQualitySolvePath({ source: "voice", questionText: "What is a mutex?" }), "T1: voice is speed");
  assert(
    pickStreamModel({ source: "voice", questionText: "What is a mutex?" }, config) === "gpt-4.1-nano",
    "T1: voice uses nano",
  );
}

// Screenshot-only → quality
{
  assert(isQualitySolvePath({ source: "screenshot", imageBase64: "abc" }), "T2: screenshot quality");
  assert(
    pickStreamModel({ source: "screenshot", imageBase64: "abc" }, config) === "gpt-6-luna",
    "T2: screenshot uses luna",
  );
}

// Voice + screenshot → quality
{
  const fused = {
    source: "voice" as const,
    questionText: "Why is this test failing?",
    imageBase64: "abc",
  };
  assert(isQualitySolvePath(fused), "T3: voice+shot quality");
  assert(pickStreamModel(fused, config) === "gpt-6-luna", "T3: voice+shot uses luna");
  assert(!isTrivialVoiceFollowUp(fused), "T3: screenshot never nano");
}

// Pasted text → quality
{
  assert(isQualitySolvePath({ source: "text", questionText: "Design a rate limiter" }), "T4: text quality");
  assert(
    pickStreamModel({ source: "text", questionText: "Design a rate limiter" }, config) === "gpt-6-luna",
    "T4: text uses luna",
  );
}

// Missing source + text (no image) → quality (safer than assuming voice)
{
  assert(isQualitySolvePath({ questionText: "Explain CAP theorem" }), "T5: omitted source + text");
  assert(
    pickStreamModel({ questionText: "Explain CAP theorem" }, config) === "gpt-6-luna",
    "T5: omitted source uses luna",
  );
}

// Trivial voice follow-up → nano
{
  const trivial = {
    source: "voice" as const,
    questionText: "Why?",
    conversationContext: "Q: Two sum\nA: Hash map",
  };
  assert(isTrivialVoiceFollowUp(trivial), "T6: short voice follow-up");
  assert(pickStreamModel(trivial, config) === "gpt-4.1-nano", "T6: nano for trivial follow-up");
}

// Non-trivial voice follow-up stays on mini
{
  const follow = {
    source: "voice" as const,
    questionText: "How would you implement this with a concurrent hash map under write-heavy load?",
    conversationContext: "Q: Two sum\nA: Hash map",
  };
  assert(!isTrivialVoiceFollowUp(follow), "T7: long follow-up not trivial");
  assert(pickStreamModel(follow, config) === "gpt-4.1-nano", "T7: voice-only stays nano");
}

// Token floors
{
  const shotTokens = getAnswerMaxTokens(
    { source: "screenshot", imageBase64: "abc", mode: "dsa" },
    "Implement LRU cache",
  );
  assert(shotTokens >= 1200, `T8: screenshot tokens >= 1200, got ${shotTokens}`);
  const designTokens = getAnswerMaxTokens(
    { source: "text", questionText: "Design Twitter", mode: "system_design" },
    "Design Twitter",
  );
  assert(designTokens >= 2800, `T8: design tokens >= 2800, got ${designTokens}`);
  const voiceTokens = getAnswerMaxTokens(
    { source: "voice", questionText: "What is REST?" },
    "What is REST?",
  );
  assert(voiceTokens >= 600, `T8: voice tokens >= 600, got ${voiceTokens}`);
  assert(getQualityAnswerMaxTokens() >= 1200, "T8: quality floor");
  assert(getVoiceAnswerMaxTokens() >= 600, "T8: voice floor");
}

// Image detail defaults high
{
  const prev = process.env.OPENAI_IMAGE_DETAIL;
  delete process.env.OPENAI_IMAGE_DETAIL;
  assert(getAnswerImageDetail() === "high", "T9: default image detail high");
  if (prev !== undefined) process.env.OPENAI_IMAGE_DETAIL = prev;
}

console.log("solve-routing.verify: all checks passed");
