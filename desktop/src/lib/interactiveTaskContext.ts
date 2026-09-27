/**
 * Deterministic Interactive TaskSession context builder (Step 6).
 * Local string/metadata only — no AI, OCR, CV, or network.
 *
 * Task context is continuity data. Current question + screen remain strongest evidence.
 */
import type { InteractiveCaptureReason } from "./interactiveCapture";
import { isValidCapturePayload } from "./interactiveCapture";
import {
  TASK_CONTEXT_MAX_CHARS,
  TASK_GUIDANCE_EXCERPT_CHARS,
  TASK_SESSION_MAX_FRAMES,
  TASK_SESSION_MAX_GUIDANCE,
  createTaskSession,
  frameRefFromCapture,
  hashImageFingerprint,
  type TaskContext,
  type TaskFrameRef,
  type TaskSession,
} from "./taskSession";

/** Soft target for formatted context (hard ceiling remains TASK_CONTEXT_MAX_CHARS). */
export const TASK_FORMATTED_CONTEXT_TARGET_CHARS = 4000;

export const TASK_BRIEF_MAX_CHARS = 600;
export const TASK_BRIEF_MIN_CHARS = 8;

export const TASK_PROGRESS_MAX_NOTES = 10;
export const TASK_PROGRESS_NOTE_MAX_CHARS = 200;

export const TASK_ENV_HINTS_MAX = 6;
export const TASK_ENV_HINT_MAX_CHARS = 120;

export const TASK_ARTIFACTS_MAX = 6;
export const TASK_ARTIFACT_SUMMARY_MAX_CHARS = 160;

export const TASK_GUIDANCE_FORMAT_MAX = 4;
export const TASK_FRAMES_FORMAT_MAX = 3;

const CONTEXT_PREAMBLE =
  "CONTEXT DATA (continuity only — current interviewer ask and current screen override if newer):";

function clampText(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function normKey(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function isMeaningfulTaskText(text: string): boolean {
  const t = text.trim();
  if (t.length < TASK_BRIEF_MIN_CHARS) return false;
  // Ignore pure filler / UI placeholders.
  if (/^(okay|ok|yes|no|hmm+|uh+|um+|thanks|thank you)[.!?]*$/i.test(t)) return false;
  return true;
}

export function initializeInteractiveTaskSession(
  partial?: Partial<TaskSession>,
): TaskSession {
  return createTaskSession(partial);
}

/**
 * Set or carefully extend taskBrief from explicit interviewer/question text.
 * Never invents requirements; never replaces with unrelated text.
 */
export function updateTaskBriefFromLocalText(
  session: TaskSession,
  raw: string | undefined | null,
): TaskSession {
  const text = clampText(raw || "", TASK_BRIEF_MAX_CHARS);
  if (!isMeaningfulTaskText(text)) return session;

  const existing = session.taskBrief?.trim() || "";
  if (!existing) {
    return { ...session, updatedAt: Date.now(), taskBrief: text };
  }

  const existingKey = normKey(existing);
  const textKey = normKey(text);
  if (textKey === existingKey) return session;

  // Controlled extension: newer wording contains the prior brief and adds substance.
  if (textKey.includes(existingKey) && text.length >= existing.length + 12) {
    return {
      ...session,
      updatedAt: Date.now(),
      taskBrief: clampText(text, TASK_BRIEF_MAX_CHARS),
    };
  }

  return session;
}

/** Explicit local environment hint only (document name, window title, user text). */
export function appendExplicitEnvironmentHint(
  session: TaskSession,
  hint: string | undefined | null,
): TaskSession {
  const value = clampText(hint || "", TASK_ENV_HINT_MAX_CHARS);
  if (!value || value.length < 2) return session;
  const key = normKey(value);
  if (session.environmentHints.some((h) => normKey(h) === key)) return session;
  return {
    ...session,
    updatedAt: Date.now(),
    environmentHints: [value, ...session.environmentHints].slice(0, TASK_ENV_HINTS_MAX),
  };
}

/** Document name metadata only — never the document body. */
export function appendDocumentNameHint(
  session: TaskSession,
  documentName: string | undefined | null,
): TaskSession {
  const name = documentName?.trim();
  if (!name) return session;
  return appendExplicitEnvironmentHint(session, `document: ${name}`);
}

export function appendProgressNote(
  session: TaskSession,
  note: string | undefined | null,
): TaskSession {
  const value = clampText(note || "", TASK_PROGRESS_NOTE_MAX_CHARS);
  if (!value || value.length < 4) return session;
  const key = normKey(value);
  if (session.progressNotes.some((n) => normKey(n) === key)) return session;
  return {
    ...session,
    updatedAt: Date.now(),
    progressNotes: [value, ...session.progressNotes].slice(0, TASK_PROGRESS_MAX_NOTES),
  };
}

/**
 * Compact guidance excerpt after a successful Interactive answer.
 * Dedupes identical excerpts; no LLM summarization.
 */
export function appendGuidanceHistory(
  session: TaskSession,
  prompt: string | undefined,
  guidance: string | undefined,
): TaskSession {
  const excerpt = clampText(guidance || "", TASK_GUIDANCE_EXCERPT_CHARS);
  if (!excerpt) return session;
  const key = normKey(excerpt);
  if (session.guidanceHistory.some((g) => normKey(g.guidance) === key)) {
    return session;
  }
  const entry = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `g-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    prompt: prompt?.trim() ? clampText(prompt, 120) : undefined,
    guidance: excerpt,
  };
  return {
    ...session,
    updatedAt: Date.now(),
    guidanceHistory: [entry, ...session.guidanceHistory].slice(0, TASK_SESSION_MAX_GUIDANCE),
  };
}

/**
 * Append frame metadata from a capture. Never stores image bytes.
 * Suppresses duplicate consecutive hashes unless force.
 */
export function appendFrameMetadata(
  session: TaskSession,
  imageBase64: string,
  reason?: InteractiveCaptureReason,
  opts?: { force?: boolean },
): TaskSession {
  if (!isValidCapturePayload(imageBase64)) return session;
  const hash = hashImageFingerprint(imageBase64);
  if (
    !opts?.force &&
    session.lastFrames[0]?.hash &&
    session.lastFrames[0].hash === hash
  ) {
    return session;
  }
  const frame: TaskFrameRef = frameRefFromCapture(imageBase64, { reason });
  return {
    ...session,
    updatedAt: Date.now(),
    lastFrames: [frame, ...session.lastFrames].slice(0, TASK_SESSION_MAX_FRAMES),
  };
}

/** Interviewer / question submission (finalized text only). */
export function applyInterviewerQuestionToContext(
  session: TaskSession,
  questionText: string | undefined | null,
): TaskSession {
  const q = questionText?.trim() || "";
  if (!isMeaningfulTaskText(q)) return session;
  let next = updateTaskBriefFromLocalText(session, q);
  next = appendProgressNote(next, `Interviewer ask: ${clampText(q, 160)}`);
  return next;
}

/** Candidate voice/text submission (finalized STT or chat only — never partials). */
export function applyCandidateSubmissionToContext(
  session: TaskSession,
  text: string | undefined | null,
  source: "voice" | "text",
): TaskSession {
  const t = text?.trim() || "";
  if (!isMeaningfulTaskText(t)) return session;
  const label = source === "voice" ? "Candidate said" : "Candidate submitted";
  return appendProgressNote(session, `${label}: ${clampText(t, 160)}`);
}

/** After successful Interactive AI answer — compact local guidance only. */
export function applyInteractiveAnswerToContext(
  session: TaskSession,
  question: string | undefined,
  guidance: string,
): TaskSession {
  let next = updateTaskBriefFromLocalText(session, question);
  next = appendGuidanceHistory(next, question, guidance);
  return next;
}

function joinBullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

/**
 * Deterministic AI-facing taskContext.
 * Order: task → environment → artifacts → progress → frames → guidance.
 */
export function buildFormattedTaskContext(
  session: TaskSession | null | undefined,
): TaskContext | undefined {
  if (!session) return undefined;

  const sections: string[] = [CONTEXT_PREAMBLE];

  if (session.taskBrief?.trim()) {
    sections.push(`CURRENT TASK:\n${clampText(session.taskBrief, TASK_BRIEF_MAX_CHARS)}`);
  }

  if (session.environmentHints.length) {
    sections.push(
      `ENVIRONMENT HINTS:\n${joinBullets(
        session.environmentHints.slice(0, TASK_ENV_HINTS_MAX).map((h) =>
          clampText(h, TASK_ENV_HINT_MAX_CHARS),
        ),
      )}`,
    );
  }

  if (session.visibleArtifacts.length) {
    sections.push(
      `VISIBLE ARTIFACTS:\n${joinBullets(
        session.visibleArtifacts.slice(0, TASK_ARTIFACTS_MAX).map((a) =>
          clampText(a.summary, TASK_ARTIFACT_SUMMARY_MAX_CHARS),
        ),
      )}`,
    );
  }

  if (session.progressNotes.length) {
    sections.push(
      `RECENT PROGRESS:\n${joinBullets(
        session.progressNotes.slice(0, TASK_PROGRESS_MAX_NOTES).map((n) =>
          clampText(n, TASK_PROGRESS_NOTE_MAX_CHARS),
        ),
      )}`,
    );
  }

  if (session.lastFrames.length) {
    const frames = session.lastFrames.slice(0, TASK_FRAMES_FORMAT_MAX).map((f) => {
      const parts = [
        f.reason ? `reason=${f.reason}` : null,
        f.hash ? `hash=${f.hash}` : null,
        f.capturedAt ? `at=${new Date(f.capturedAt).toISOString()}` : null,
      ].filter(Boolean);
      return parts.join(" ");
    });
    sections.push(`RECENT SCREEN REFS:\n${joinBullets(frames)}`);
  }

  if (session.guidanceHistory.length) {
    const recent = session.guidanceHistory.slice(0, TASK_GUIDANCE_FORMAT_MAX);
    sections.push(
      `RECENT GUIDANCE:\n${joinBullets(
        recent.map((g) =>
          g.prompt
            ? `(${clampText(g.prompt, 80)}) ${clampText(g.guidance, TASK_GUIDANCE_EXCERPT_CHARS)}`
            : clampText(g.guidance, TASK_GUIDANCE_EXCERPT_CHARS),
        ),
      )}`,
    );
  }

  if (sections.length <= 1) return undefined;

  let text = sections.join("\n\n");
  const budget = Math.min(TASK_FORMATTED_CONTEXT_TARGET_CHARS, TASK_CONTEXT_MAX_CHARS);
  if (text.length > budget) {
    // Prefer keeping task brief: trim from the end of later sections at a boundary.
    text = `${text.slice(0, budget - 1)}…`;
  }
  return text;
}
