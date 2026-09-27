/** Fast local checks — interviewer vs candidate — before hitting the API. */

const CANDIDATE_SPEECH =
  /\b(i think|i would|i will|i'd|i can|i am|i'm|my approach|my solution|let me explain|let me think|so i|in my experience|we can use|i'll use|i have used|thank you|thanks for|great question|makes sense|sounds good|yes so|okay so i)\b/i;

const CANDIDATE_CLARIFICATION =
  /\b(sorry|pardon|come again|didn't understand|don't understand|did not understand|not clear|what do you mean|can you repeat|could you repeat|say that again|explain again|didn't get|don't get|confused about|can you clarify what)\b/i;

const DISCUSSION_FRAGMENT =
  /\b(i mean|what i'?m asking|let me rephrase|to be clear|just to confirm|are you asking|do you mean|hold on|wait|one second|give me a moment|let me explain the question|the question is actually)\b/i;

const INTERVIEWER_ACK =
  /^(okay|ok|yes|yeah|right|good|great|nice|continue|go on|sure|alright|hmm|uh huh|i see)[\s.!?,]*$/i;

const INTERVIEWER_QUESTION =
  /\b(can you|could you|would you|tell me|explain|what is|what are|what does|what do|how would you|how do you|why did you|why would you|walk me through|describe|implement|write (?:a |code|an? )?|solve this|difference between|design (?:a |an )?|given an? |suppose you|your task is|the question is|build (?:a |an )?)\b/i;

export function isLikelyCandidateSpeech(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  if (isCandidateClarificationRequest(trimmed)) return true;
  return CANDIDATE_SPEECH.test(trimmed);
}

export function isCandidateClarificationRequest(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 6) return false;
  return CANDIDATE_CLARIFICATION.test(trimmed);
}

export function isDiscussionFragment(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 6) return false;
  if (INTERVIEWER_ACK.test(trimmed)) return true;
  return DISCUSSION_FRAGMENT.test(trimmed);
}

export function isClearlyInterviewerQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) return false;
  if (isLikelyCandidateSpeech(trimmed)) return false;
  if (isDiscussionFragment(trimmed) && !trimmed.endsWith("?")) return false;
  if (trimmed.endsWith("?")) return true;
  return INTERVIEWER_QUESTION.test(trimmed);
}

/** Trailing phrases that mean the interviewer is still mid-question. */
const TRUNCATED_TAIL =
  /\b(the difference|the differences|difference between|differences between|the relationship|compare(?:\s+and\s+contrast)?|versus|vs\.?|tell me about|walk me through|what about|how about)$/i;

/** Question was cut off before the object / clause — do not answer yet. */
export function isTruncatedQuestion(text: string): boolean {
  const trimmed = text.trim().replace(/[?.!,;:]+$/g, "");
  if (!trimmed) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);

  // Stub asks that need an object: "Explain the difference", "Tell me about", "What about"
  if (words.length <= 4 && /^(explain|describe|tell me|what about|how about|compare)\b/i.test(trimmed)) {
    return true;
  }
  if (TRUNCATED_TAIL.test(trimmed)) return true;
  if (/\b(the|a|an|of|in|on|to|for|and|or|with|from|is|are|your|this|between|and)\s*$/i.test(trimmed)) {
    return true;
  }
  return false;
}

/** Long spoken problem statements (often no "?") — probability / DSA setups. */
const PROBLEM_STATEMENT =
  /\b(there (?:are|is)|given (?:an?|two|the)|suppose|consider|each (?:user|node|element|person)|expected (?:value|number)|probability|randomly (?:chooses?|selected)|mutual|group [ab]|prove that|show that|compute|find the|two (?:distinct )?groups|best friend)\b/i;

/** Question is complete enough to answer now — don't wait for leftover speaker audio. */
export function isCompleteSpokenQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!isSubstantialQuestion(trimmed)) return false;
  if (isTruncatedQuestion(trimmed)) return false;
  if (trimmed.endsWith("?")) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  // Short/mid interviewer asks without "?":
  // "Design a URL shortener service like Bitly." / "Implement LRU cache in Python"
  // Previously required 8+ words OR a what/how prefix — 6–7 word Design/Implement
  // asks stayed as live drafts forever and never flushed an answer.
  if (words.length >= 5 && isClearlyInterviewerQuestion(trimmed)) {
    return true;
  }
  // Multi-sentence interview prompts rarely end with "?" — answer once long enough.
  if (words.length >= 28 && PROBLEM_STATEMENT.test(trimmed) && /[.!]\s*$/.test(trimmed)) {
    return true;
  }
  if (words.length >= 40 && /[.!]\s*$/.test(trimmed) && !isLikelyCandidateSpeech(trimmed)) {
    return true;
  }
  return false;
}

export function mightNeedClassification(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 15) return false;
  if (isLikelyCandidateSpeech(trimmed)) return false;
  if (isDiscussionFragment(trimmed)) return true;
  if (isClearlyInterviewerQuestion(trimmed)) return false;
  return /\?|explain|what|how|why|implement|design|solve|write|describe|mean|asking|clear|repeat/i.test(
    trimmed,
  );
}

const GENERIC_QUESTION_LABEL =
  /^(on[- ]screen question|screenshot question|question|on-screen question|reading question…|reading question\.\.\.)$/i;

export function isGenericQuestionLabel(text: string) {
  const trimmed = text.trim();
  return !trimmed || GENERIC_QUESTION_LABEL.test(trimmed);
}

/** Spoken asks that mean "solve what's on the monitor", not a standalone audio question. */
export function refersToOnScreenQuestion(text: string) {
  // Do NOT match bare "screenshot" — that auto-fired vision solve and killed voice answers.
  return /\b((on|this) screen|on[- ]screen|this (page|screenshot)|what('s| is) (the |this )?(question|problem) on (this |the )?(screen|page)|solve (what('s| is) )?on (this |the )?screen)\b/i.test(
    text.trim(),
  );
}

export function pickDisplayQuestion(original: string, aiHeadline?: string | null) {
  const orig = collapseDuplicateQuestionLines(original.trim());
  const ai = collapseDuplicateQuestionLines(aiHeadline?.trim() ?? "");
  if (orig && !isGenericQuestionLabel(orig)) return orig;
  if (ai && !isGenericQuestionLabel(ai)) return ai;
  // Never surface placeholders like "Screenshot question" in the UI.
  return "";
}

function collapseDuplicateQuestionLines(text: string) {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const unique: string[] = [];
  for (const line of lines) {
    const prev = unique[unique.length - 1];
    if (prev && normalizeUtterance(line) === normalizeUtterance(prev)) continue;
    unique.push(line.replace(/^(?:#{1,3}\s*)?Q:\s*/i, "").trim());
  }
  return unique.join(" ").trim();
}

export function stripRepeatedQuestion(answer: string, question: string) {
  const q = question.trim();
  if (!q || q.length < 8) return answer;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return answer
    .replace(new RegExp(`^(?:#{1,3}\\s*)?(?:Q:\\s*)?${escaped}(?:\\s*[?.!]*)?\\s*`, "i"), "")
    .trimStart();
}

export function normalizeUtterance(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

const NOISE_UTTERANCE =
  /^(you|thank you|thanks|okay|ok|hmm+|uh+|um+|the|a|an|so|and|it|is|this|that|on[- ]screen question|what|bye|hi|hey|hup)[\s.!?,]*$/i;

const WHISPER_HALLUCINATION =
  /\b(thanks for watching|thank you for watching|see you next time|please subscribe|subscribe to|run for your lives|subtitles by|amara\.org|like and subscribe|copyright|\bsubscribe\b|\btranscribed\b)/i;

/** Whisper often echoes its prompt when the clip is short/noisy. */
const WHISPER_PROMPT_ECHO =
  /\b(ignore filler words|no commentary|job interview\.?\s*transcribe|transcribe the interviewer'?s spoken question|fix obvious speech-to-text errors)\b/i;

export function isWhisperHallucination(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (WHISPER_HALLUCINATION.test(trimmed)) return true;
  if (WHISPER_PROMPT_ECHO.test(trimmed)) return true;
  if (/^[A-Z0-9\s!?.',-]{8,}$/.test(trimmed) && trimmed === trimmed.toUpperCase()) return true;
  return false;
}

/** True when `next` is a longer completion of `previous` (same ask, more words). */
export function isQuestionExtension(previous: string, next: string) {
  const left = normalizeUtterance(previous).replace(/[?.!,;:]+$/g, "");
  const right = normalizeUtterance(next).replace(/[?.!,;:]+$/g, "");
  if (!left || !right || right.length <= left.length + 3) return false;
  if (right === left) return false;
  if (right.startsWith(left) || right.includes(left)) return true;
  const leftWords = left.split(" ").filter(Boolean);
  const rightWords = right.split(" ").filter(Boolean);
  if (leftWords.length < 3 || rightWords.length <= leftWords.length) return false;
  const head = leftWords.slice(0, Math.min(4, leftWords.length)).join(" ");
  return right.startsWith(head) && rightWords.length >= leftWords.length + 2;
}

export function isNoiseTranscription(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (isWhisperHallucination(trimmed)) return true;
  if (NOISE_UTTERANCE.test(trimmed)) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 3 && !trimmed.includes("?")) return true;
  return false;
}

export function isSimilarUtterance(a: string, b: string | null | undefined) {
  if (!b) return false;
  const left = normalizeUtterance(a);
  const right = normalizeUtterance(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const wordsA = new Set(left.split(" ").filter(Boolean));
  const wordsB = new Set(right.split(" ").filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap += 1;
  }
  return overlap / Math.max(wordsA.size, wordsB.size) >= 0.65;
}

/**
 * Strict "same ask" check for already-answered / stale gates.
 * Bag-of-words similarity is too loose (two different array problems look "similar")
 * and was blocking brand-new questions after Ctrl+Enter.
 */
export function isSameSpokenQuestion(a: string, b: string | null | undefined) {
  if (!b) return false;
  const left = normalizeUtterance(a).replace(/[?.!,;:]+$/g, "");
  const right = normalizeUtterance(b).replace(/[?.!,;:]+$/g, "");
  if (!left || !right) return false;
  if (left === right) return true;

  // Longer clip of the same ask (extension / punctuation growth).
  if (isQuestionExtension(left, right) || isQuestionExtension(right, left)) return true;

  // One contains the other only when lengths are nearly equal (not a shared phrase).
  if (left.includes(right) || right.includes(left)) {
    const ratio =
      Math.min(left.length, right.length) / Math.max(left.length, right.length);
    return ratio >= 0.82;
  }

  // Same long prefix → same growing utterance, not a different problem.
  const prefixLen = Math.min(left.length, right.length, 48);
  if (prefixLen >= 28 && left.slice(0, prefixLen) === right.slice(0, prefixLen)) {
    return true;
  }
  return false;
}

const CONTINUATION_START =
  /^(and|or|but|so|then|also|please|when|where|to|for|of|with|that|which|if|in|on|the|a|an|your|this|these|those|function|method|class|should|would|could|do|does|did|is|are|was|were|you|we|it|use|using)\b/i;

const NEW_QUESTION_START =
  /^(what|how|why|can you|could you|would you|tell me|explain|describe|walk me|implement|write|design)\b/i;

function stripEndingPunctuation(text: string) {
  return text.replace(/[?.!,;:]+$/g, "");
}

function wordsOf(text: string) {
  return stripEndingPunctuation(text).split(" ").filter(Boolean);
}

/** True when `next` is the rest of the same interviewer question, not a new one. */
export function isUtteranceContinuation(previous: string, next: string) {
  const leftRaw = previous.trim();
  const rightRaw = next.trim();
  if (!leftRaw) return true;
  if (!rightRaw) return false;

  const left = stripEndingPunctuation(normalizeUtterance(leftRaw));
  const right = stripEndingPunctuation(normalizeUtterance(rightRaw));
  if (!left) return true;
  if (right.includes(left) || left.includes(right)) return true;

  const leftWords = wordsOf(left);
  const rightWords = wordsOf(right);
  const tail = leftWords.slice(-4).join(" ");
  if (tail.length >= 6 && right.includes(tail)) return true;

  for (let n = Math.min(4, leftWords.length, rightWords.length); n >= 1; n -= 1) {
    const leftTail = leftWords.slice(-n).join(" ");
    const rightHead = rightWords.slice(0, n).join(" ");
    if (leftTail === rightHead && leftTail.length >= 3) return true;
  }

  if (CONTINUATION_START.test(rightRaw) && !NEW_QUESTION_START.test(rightRaw)) return true;

  // Only "?" ends a spoken ask for merge purposes. Whisper adds periods between
  // sentences of the same long problem — treating "." as done broke stitching
  // and left Response stuck on the last scrap ("They form a mutual best.").
  const prevEndedAsk = /\?\s*$/.test(leftRaw);
  if (prevEndedAsk) {
    if (NEW_QUESTION_START.test(rightRaw) && rightWords.length >= 6) return false;
    if (isClearlyInterviewerQuestion(rightRaw) && rightWords.length >= 6) return false;
    // Short trailing clause after "?" ("…? In Python.") can still be same ask.
    if (rightWords.length <= 10) return true;
    return false;
  }

  // Mid-problem narrative: prefer merge within the continue window.
  if (rightWords.length <= 14) return true;
  if (PROBLEM_STATEMENT.test(rightRaw) || PROBLEM_STATEMENT.test(leftRaw)) return true;
  if (NEW_QUESTION_START.test(rightRaw) && leftWords.length >= 20 && /[.!]\s*$/.test(leftRaw)) {
    return false;
  }
  return true;
}

export function mergeUtterance(previous: string, next: string) {
  const left = previous.trim();
  const right = next.trim();
  if (!left) return right;
  if (!right) return left;

  const leftN = normalizeUtterance(left);
  const rightN = normalizeUtterance(right);
  if (rightN.includes(leftN) && right.length >= left.length) return right;
  if (leftN.includes(rightN) && left.length >= right.length) return left;

  const leftWords = left.split(/\s+/);
  const rightWords = right.split(/\s+/);
  let overlap = 0;
  for (let n = Math.min(6, leftWords.length, rightWords.length); n >= 1; n -= 1) {
    const a = stripEndingPunctuation(leftWords.slice(-n).join(" ").toLowerCase());
    const b = stripEndingPunctuation(rightWords.slice(0, n).join(" ").toLowerCase());
    if (a === b) {
      overlap = n;
      break;
    }
  }
  if (overlap > 0) {
    return [...leftWords, ...rightWords.slice(overlap)].join(" ").trim();
  }
  return `${left} ${right}`.trim();
}

const EXPLICIT_FOLLOW_UP =
  /\b(what if|how about|how would|instead|without|with sorted|follow[- ]?up|modify|change (the|it|this)|another (approach|way|solution|method|constraint|option)|other (approach|way|solution|method)|different (approach|way|solution|method)|alternate|alternative|brute[- ]?force|optimize(?:\s+it|\s+further|\s+this)?|optimis(?:e|ation)|better (approach|way|solution|complexity)|time complexity|space complexity|edge case|handle when|duplicate|negative numbers|empty array|return all|not just|any order|k sorted|two pointers|do it in|what about|same problem|variant|variation|tweak|assume|given that|if the array|if we|but what|one more|and if|still works|works when|time limit|memory limit|constant space|O\(1\)|O\(n\)|log n|sorted order|unsorted|distinct|unique|constraints change|write (?:the )?(?:code|solution)|now (?:write|solve|do|try|implement)|try (?:again|another)|same (?:question|problem|one)|continue|go on|next (?:step|part)|walk (?:me )?through|dry[- ]?run|trace|explain (?:that|this|the|your)|why (?:this|that|not|did|would|do|use)|trade[- ]?off|use cases?|pros?(?: and cons)?|cons\b|advantages?|disadvantages?|when (?:would|do|should) (?:you|we|i)|real[- ]?world|in practice|tell me more|go deeper|elaborate|more detail|give (?:me )?(?:an? )?example|code example|example code|sample code|show (?:me )?(?:the )?code|give (?:me )?(?:a |an |the )?(?:code|example|snippet)|(?:can|could|would) you (?:please )?(?:give|show|write|share|provide|add|include|explain that|explain this))\b/i;

const DEICTIC_FOLLOW_UP =
  /\b(this|that|it|its|your (?:answer|approach|solution|code)|the (?:previous|prior|same|above|last)|same (?:problem|question|one)|the (?:approach|solution|code|implementation|function|method))\b/i;

const INDEPENDENT_NEW_ASK =
  /^(what|what's|whats|how|why|can you|could you|would you|tell me|explain|describe|walk me|implement|write|design|have you|do you)\b/i;

const INDEPENDENT_TOPIC =
  /\b(tell me about yourself|your (?:background|experience)|design a |system design)\b/i;

export function isFollowUpQuestion(text: string, previousQuestion?: string | null) {
  const trimmed = text.trim();
  if (!trimmed || !previousQuestion?.trim()) return false;

  // Explicit follow-up / continuation cues (spoken interview style).
  if (EXPLICIT_FOLLOW_UP.test(trimmed)) return true;

  // Short elliptical asks continue the prior problem ("other approach", "in Python").
  // A complete new opener ("How does React work?") is NOT a follow-up just because
  // it contains "how" — that was re-solving the previous screenshot on audio turns.
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 12 && !INDEPENDENT_TOPIC.test(trimmed)) {
    if (INDEPENDENT_NEW_ASK.test(trimmed) && !DEICTIC_FOLLOW_UP.test(trimmed)) {
      return false;
    }
    if (
      /\b(approach|solution|method|code|example|optimize|complexity|hash|map|array|pointer|recursion|dp|stack|queue|tree|graph|sql|query|index|cache|api|class|object|schema|pipeline|test|deploy|model|metric|use cases?|pros?|cons|why|when|where|how|python|java|javascript|typescript)\b/i.test(
        trimmed,
      )
    ) {
      return true;
    }
  }

  return false;
}

/** True when the new ask is a different problem, not a continuation of `previousQuestion`. */
export function isNewIndependentQuestion(text: string, previousQuestion?: string | null) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const prior = previousQuestion?.trim() || "";
  if (prior && isFollowUpQuestion(trimmed, prior)) return false;
  if (prior && isQuestionExtension(prior, trimmed)) return false;
  if (INDEPENDENT_TOPIC.test(trimmed)) return true;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (INDEPENDENT_NEW_ASK.test(trimmed) && !DEICTIC_FOLLOW_UP.test(trimmed)) {
    if (words.length >= 4) return true;
    if (
      words.length >= 3 &&
      /^(what|what's|whats|how|why|explain|describe|tell me)\b/i.test(trimmed)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * After a combine / screen answer, hold that question until a new independent ask.
 * Follow-ups ("in Python", "time complexity", "optimize it") stay on the last thread.
 */
export function shouldContinueLastThread(input: {
  newQuestion?: string | null;
  priorQuestion?: string | null;
  lastSolveHadScreen?: boolean;
}): boolean {
  const question = input.newQuestion?.trim() || "";
  const prior = input.priorQuestion?.trim() || "";
  if (!question || !prior) return false;
  if (isFollowUpQuestion(question, prior)) return true;
  if (!input.lastSolveHadScreen) return false;
  return !isNewIndependentQuestion(question, prior);
}

/**
 * Prior screenshot/audio Q&A may attach only when the new ask continues that thread.
 * After combine, hold last Q until a clearly new independent question.
 */
export function shouldAttachConversationContext(input: {
  questionText?: string | null;
  priorQuestion?: string | null;
  lastSolveHadScreen?: boolean;
}): boolean {
  return shouldContinueLastThread({
    newQuestion: input.questionText,
    priorQuestion: input.priorQuestion,
    lastSolveHadScreen: input.lastSolveHadScreen,
  });
}
export function isSubstantialQuestion(text: string) {
  const trimmed = text.trim();
  if (isNoiseTranscription(trimmed)) return false;
  if (trimmed.includes("?")) return trimmed.length >= 10;
  if (isClearlyInterviewerQuestion(trimmed)) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  // Long declarative problem statements (no "what/how") still need a solve.
  if (words.length >= 28 && PROBLEM_STATEMENT.test(trimmed)) return true;
  return trimmed.length >= 18 && /\b(what|how|why|explain|describe|implement|write|design|difference)\b/i.test(
    trimmed,
  );
}

export function buildQuestionFromContext(recentInterviewerLines: string[], latest: string): string {
  const parts = [...recentInterviewerLines, latest]
    .map((line) => line.trim())
    .filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    const key = normalizeUtterance(part);
    if (!unique.some((existing) => normalizeUtterance(existing) === key)) {
      unique.push(part);
    }
  }
  return unique.join(" ").trim();
}

/** HR / behavioral asks — only then attach resume (keeps paste/coding TTFT low). */
export function questionNeedsResume(question: string): boolean {
  return /tell me about yourself|introduce yourself|about yourself|your (background|experience|resume|cv|career|journey)|walk me through (your )?(resume|cv|background|experience|career)|why should we hire|why (are you|do you want)|why (this|our) (company|role|team|opportunity)|why.*(change|leave|looking|switch|move)|notice period|available to join|joining date|date of joining|interview availability|relocat|location preference|current (\/|or )?expected salary|salary expectation|\bctc\b|compensation expectation|total experience|years of experience|professional experience|how many years|current (company|role|project|position|work|job)|previous (role|project|company|job)|what are you (currently )?(working on|doing)|your (typical )?day|responsibilities|what (part|portion) (of|did)|your contribution|who (are|were) the users|what problem does|challenging (part|project|problem)|technical decision|production issue|outage you|incident you|biggest achievement|proudest|difficult problem|leadership experience|describe a time|tell me about a time|tell me about a (situation|project|conflict|mistake|failure|challenge)|your (strengths|skills|weakness|weaknesses)|what did you do at|what was your role|which technolog|tech stack you|why did you choose (this|that|the)|conflict with|difficult stakeholder|made a mistake|handle(d)? pressure|how do you prioritiz|changing requirements|have you mentor|mentored anyone|took ownership|took end[- ]to[- ]end ownership|influenced (the )?technical|team(mate)? conflict|disagreed with/i.test(
    question,
  );
}
