/**
 * Local heuristics to clean interview question lists for the dashboard.
 * No GPT / no extra API — used at parse (GET) and upsert (POST) time.
 */

const GENERIC_LABEL =
  /^(on[- ]screen question|screenshot question|question|on-screen question|reading question…|reading question\.\.\.)$/i;

const NOISE =
  /^(you|thank you|thanks|okay|ok|hmm+|uh+|um+|the|a|an|so|and|it|is|this|that|what|bye|hi|hey|hup|yes|yeah|right|good|great|nice|sure|alright)[\s.!?,]*$/i;

const WHISPER_JUNK =
  /\b(thanks for watching|thank you for watching|see you next time|please subscribe|subscribe to|subtitles by|amara\.org|like and subscribe|copyright|\btranscribed\b|ignore filler words|no commentary|job interview\.?\s*transcribe|transcribe the interviewer)\b/i;

const TRUNCATED_TAIL =
  /\b(the difference|the differences|difference between|differences between|the relationship|compare(?:\s+and\s+contrast)?|versus|vs\.?|tell me about|walk me through|what about|how about)$/i;

const INTERVIEWER_CUE =
  /\b(can you|could you|would you|tell me|explain|what is|what are|what does|what do|how would you|how do you|why did you|why would you|walk me through|describe|implement|write (?:a |code|an? )?|solve this|difference between|design (?:a |an )?|given an? |suppose you|build (?:a |an )?)\b/i;

const PROBLEM_STATEMENT =
  /\b(there (?:are|is)|given (?:an?|two|the)|suppose|consider|expected (?:value|number)|probability|prove that|show that|compute|find the)\b/i;

const CANDIDATE_SPEECH =
  /\b(i think|i would|i will|i'd|i can|i am|i'm|my approach|my solution|let me explain|let me think|in my experience|thank you|thanks for|great question|makes sense|sounds good)\b/i;

export function normalizeQuestionKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:]+$/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isTruncated(text: string): boolean {
  const trimmed = text.trim().replace(/[?.!,;:]+$/g, "");
  if (!trimmed) return true;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (
    words.length <= 4 &&
    /^(explain|describe|tell me|what about|how about|compare)\b/i.test(trimmed)
  ) {
    return true;
  }
  if (TRUNCATED_TAIL.test(trimmed)) return true;
  if (
    /\b(the|a|an|of|in|on|to|for|and|or|with|from|is|are|your|this|between|and)\s*$/i.test(
      trimmed,
    )
  ) {
    return true;
  }
  return false;
}

function looksGarbled(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const letters = (trimmed.match(/[a-zA-Z]/g) || []).length;
  // Allow short asks like "Use a map?" — only reject near-empty letter soup.
  if (letters < 5) return true;
  if (!trimmed.includes("?") && letters < 8 && wordCount(trimmed) < 4) return true;
  const compact = trimmed.replace(/\s+/g, "");
  if (compact.length >= 12 && letters / compact.length < 0.4) return true;
  // Repeated filler tokens from bad STT: "the the the what"
  if (/\b(\w+)\s+\1\s+\1\b/i.test(trimmed)) return true;
  return false;
}

/** Unclear / incomplete / noise — do not show in Questions panel. */
export function isUnclearQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (GENERIC_LABEL.test(trimmed)) return true;
  if (NOISE.test(trimmed)) return true;
  if (WHISPER_JUNK.test(trimmed)) return true;
  if (looksGarbled(trimmed)) return true;
  if (isTruncated(trimmed)) return true;
  if (CANDIDATE_SPEECH.test(trimmed) && !trimmed.endsWith("?") && !INTERVIEWER_CUE.test(trimmed)) {
    return true;
  }

  const words = wordCount(trimmed);
  if (words < 3 && !trimmed.includes("?")) return true;
  if (trimmed.includes("?")) return trimmed.length < 10;
  if (INTERVIEWER_CUE.test(trimmed) && words >= 4) return false;
  if (words >= 28 && PROBLEM_STATEMENT.test(trimmed)) return false;
  if (
    trimmed.length >= 18 &&
    /\b(what|how|why|explain|describe|implement|write|design|difference)\b/i.test(trimmed)
  ) {
    return false;
  }
  // Short declarative scraps without question cues — usually unclear audio.
  return words < 6;
}

function isQuestionExtension(shorter: string, longer: string): boolean {
  const left = normalizeQuestionKey(shorter);
  const right = normalizeQuestionKey(longer);
  if (!left || !right || right.length <= left.length + 3) return false;
  if (right.startsWith(left) || right.includes(left)) return true;
  const leftWords = left.split(" ").filter(Boolean);
  const rightWords = right.split(" ").filter(Boolean);
  if (leftWords.length < 3 || rightWords.length <= leftWords.length) return false;
  const head = leftWords.slice(0, Math.min(4, leftWords.length)).join(" ");
  return right.startsWith(head) && rightWords.length >= leftWords.length + 2;
}

/** Same ask (exact / near-duplicate / extension). */
export function isSameQuestion(a: string, b: string): boolean {
  const left = normalizeQuestionKey(a);
  const right = normalizeQuestionKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (isQuestionExtension(left, right) || isQuestionExtension(right, left)) return true;
  if (left.includes(right) || right.includes(left)) {
    const ratio =
      Math.min(left.length, right.length) / Math.max(left.length, right.length);
    return ratio >= 0.82;
  }
  const prefixLen = Math.min(left.length, right.length, 48);
  if (prefixLen >= 28 && left.slice(0, prefixLen) === right.slice(0, prefixLen)) {
    return true;
  }
  // Token overlap for near-paraphrases of the same ask.
  const wordsA = new Set(left.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(right.split(" ").filter((w) => w.length > 2));
  if (wordsA.size < 4 || wordsB.size < 4) return false;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap += 1;
  }
  const jaccard = overlap / (wordsA.size + wordsB.size - overlap);
  return jaccard >= 0.78 && Math.abs(wordsA.size - wordsB.size) <= 6;
}

function preferQuestion(a: string, b: string): string {
  // Prefer clearer, more complete text.
  if (a.length !== b.length) return a.length >= b.length ? a : b;
  return a;
}

/** Drop unclear rows and collapse duplicates — keep best wording of each ask. */
export function cleanQuestionTexts(questions: string[]): string[] {
  const cleaned: string[] = [];
  for (const raw of questions) {
    const q = raw.trim();
    if (!q || isUnclearQuestion(q)) continue;
    const dupIdx = cleaned.findIndex((existing) => isSameQuestion(existing, q));
    if (dupIdx >= 0) {
      cleaned[dupIdx] = preferQuestion(cleaned[dupIdx], q);
      continue;
    }
    cleaned.push(q);
  }
  return cleaned;
}

type DayEntry = {
  id?: string;
  time?: string;
  question?: string;
  answer?: string;
  synced?: boolean;
};

type DaySession = {
  sessionId?: string;
  startedAt?: string;
  mode?: string;
  companyPack?: string;
  entries?: DayEntry[];
};

type DayFile = {
  date?: string;
  sessions?: DaySession[];
};

/**
 * Clean full day JSON string before DB upsert.
 * Removes unclear questions and merges near-duplicates across sessions.
 * Entries with a real answer are kept even if the Q text is borderline.
 */
export function cleanDayQuestionJson(questionJson: string): string {
  let parsed: DayFile;
  try {
    parsed = JSON.parse(questionJson) as DayFile;
  } catch {
    return questionJson;
  }

  if (!Array.isArray(parsed.sessions)) return questionJson;

  type Ranked = {
    sessionIndex: number;
    entry: DayEntry;
    question: string;
    hasAnswer: boolean;
  };

  const ranked: Ranked[] = [];
  parsed.sessions.forEach((session, sessionIndex) => {
    for (const entry of session.entries ?? []) {
      const question = entry.question?.trim() ?? "";
      if (!question) continue;
      const hasAnswer = Boolean(entry.answer?.trim());
      if (!hasAnswer && isUnclearQuestion(question)) continue;
      // Even with an answer, skip pure noise / hallucinations.
      if (GENERIC_LABEL.test(question) || NOISE.test(question) || WHISPER_JUNK.test(question)) {
        continue;
      }
      ranked.push({ sessionIndex, entry, question, hasAnswer });
    }
  });

  const kept: Ranked[] = [];
  for (const item of ranked) {
    const dupIdx = kept.findIndex((existing) =>
      isSameQuestion(existing.question, item.question),
    );
    if (dupIdx < 0) {
      kept.push(item);
      continue;
    }
    const prev = kept[dupIdx];
    const takeNew =
      (item.hasAnswer && !prev.hasAnswer) ||
      (item.hasAnswer === prev.hasAnswer &&
        preferQuestion(prev.question, item.question) === item.question);
    if (takeNew) {
      const mergedAnswer = item.entry.answer?.trim() || prev.entry.answer || "";
      kept[dupIdx] = {
        ...item,
        entry: {
          ...item.entry,
          question: preferQuestion(prev.question, item.question),
          answer: mergedAnswer,
        },
        question: preferQuestion(prev.question, item.question),
        hasAnswer: Boolean(mergedAnswer.trim()),
      };
    } else if (item.hasAnswer && !prev.entry.answer?.trim()) {
      kept[dupIdx] = {
        ...prev,
        entry: { ...prev.entry, answer: item.entry.answer },
        hasAnswer: true,
      };
    }
  }

  const bySession = new Map<number, DayEntry[]>();
  for (const item of kept) {
    const list = bySession.get(item.sessionIndex) ?? [];
    list.push({
      ...item.entry,
      question: item.question,
    });
    bySession.set(item.sessionIndex, list);
  }

  const sessions = parsed.sessions
    .map((session, index) => {
      const entries = bySession.get(index) ?? [];
      if (!entries.length) return null;
      return { ...session, entries };
    })
    .filter(Boolean);

  return JSON.stringify({ ...parsed, sessions });
}
