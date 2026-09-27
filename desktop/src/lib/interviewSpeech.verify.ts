/**
 * Follow-up / conversation-context gates for screenshot → audio turns.
 * Run: npx tsx src/lib/interviewSpeech.verify.ts
 */
import {
  isFollowUpQuestion,
  isNewIndependentQuestion,
  shouldAttachConversationContext,
  shouldContinueLastThread,
} from "./interviewSpeech";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const TWO_SUM =
  "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.";

assert(
  isFollowUpQuestion("What's the time complexity?", TWO_SUM),
  "time complexity after coding screenshot is a follow-up",
);
assert(
  isFollowUpQuestion("Can you optimize it?", TWO_SUM),
  "optimize it after coding screenshot is a follow-up",
);
assert(
  isFollowUpQuestion("Why this approach?", TWO_SUM),
  "why this after coding screenshot is a follow-up",
);
assert(
  isFollowUpQuestion("Now write the code", TWO_SUM),
  "now write the code is a follow-up",
);

assert(
  !isFollowUpQuestion("How does React work?", TWO_SUM),
  "new spoken topic is not a follow-up to the screenshot",
);
assert(
  !isFollowUpQuestion("Tell me about yourself", TWO_SUM),
  "HR question is not a follow-up to the screenshot",
);
assert(
  !isFollowUpQuestion("What is polymorphism?", TWO_SUM),
  "new CS question is not a follow-up to the screenshot",
);
assert(
  !isFollowUpQuestion("Design a URL shortener", TWO_SUM),
  "new system-design ask is not a follow-up to the screenshot",
);

assert(
  shouldAttachConversationContext({
    questionText: "What's the time complexity?",
    priorQuestion: TWO_SUM,
  }),
  "follow-up audio may reuse screenshot Q&A",
);
assert(
  !shouldAttachConversationContext({
    questionText: "How does garbage collection work?",
    priorQuestion: TWO_SUM,
  }),
  "independent audio must not reuse screenshot Q&A",
);
assert(
  !shouldAttachConversationContext({
    questionText: "",
    priorQuestion: TWO_SUM,
  }),
  "screenshot-only solve must not attach prior Q&A",
);
assert(
  !shouldAttachConversationContext({
    questionText: "How does React work?",
    priorQuestion: "",
  }),
  "no prior question → no conversation context",
);

assert(
  shouldContinueLastThread({
    newQuestion: "using a set",
    priorQuestion: TWO_SUM,
    lastSolveHadScreen: true,
  }),
  "after combine, short follow-up holds the last question",
);
assert(
  shouldContinueLastThread({
    newQuestion: "What's the time complexity?",
    priorQuestion: TWO_SUM,
    lastSolveHadScreen: true,
  }),
  "after combine, explicit follow-up holds the last question",
);
assert(
  !shouldContinueLastThread({
    newQuestion: "Tell me about yourself",
    priorQuestion: TWO_SUM,
    lastSolveHadScreen: true,
  }),
  "after combine, a new independent ask flushes the last question",
);
assert(
  !isNewIndependentQuestion("using a set", TWO_SUM),
  "using a set is not a new independent question",
);
assert(
  isNewIndependentQuestion("How does React work?", TWO_SUM),
  "How does React work is a new independent question",
);
assert(
  !shouldContinueLastThread({
    newQuestion: "using a set",
    priorQuestion: TWO_SUM,
    lastSolveHadScreen: false,
  }),
  "without a prior screen/combine, elliptical text does not force hold",
);

console.log("interviewSpeech.verify: all checks passed");
