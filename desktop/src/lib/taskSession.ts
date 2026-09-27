/**
 * Interactive / Hands-on is a session capability — not an InterviewModeId or SE domain.
 * Domain/task type is inferred later from evidence (speech, screen, docs), not enums.
 */

/** Soft cap for AI-facing taskContext strings (matches API schema budget). */
export const TASK_CONTEXT_MAX_CHARS = 8000;

/** Max lightweight frame refs retained on the session. */
export const TASK_SESSION_MAX_FRAMES = 8;

/** Max guidance entries retained for later context selection. */
export const TASK_SESSION_MAX_GUIDANCE = 12;

/** Max chars kept per guidance excerpt in TaskSession. */
export const TASK_GUIDANCE_EXCERPT_CHARS = 480;

/**
 * Metadata for a recent screen capture.
 * Must NEVER hold image bytes / base64 — only refs, hashes, and dimensions.
 */
export type TaskFrameRef = {
  id: string;
  capturedAt: number;
  /** Content fingerprint for future change detection — not pixel data. */
  hash?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  /** Opaque local handle if a later step stores frames outside session state. */
  localRef?: string;
  /** Why this frame was captured (Step 5 orchestration — not analytics). */
  reason?:
    | "manual"
    | "activation"
    | "question"
    | "candidate_input"
    | "answer_complete";
};

/**
 * Notable on-screen observation. `label` is free-form (e.g. "error", "diagram") —
 * not a closed domain enum.
 */
export type VisibleArtifact = {
  id: string;
  label?: string;
  summary: string;
  observedAt: number;
};

/** Compact prior Interactive guidance for this task only (not global Q&A history). */
export type TaskGuidanceEntry = {
  id: string;
  at: number;
  /** Short ask / label for this guidance turn. */
  prompt?: string;
  /** Excerpt suitable for later taskContext inclusion. */
  guidance: string;
};

/**
 * Internal Interactive / Hands-on session state.
 * Distinct from the compact AI-facing `TaskContext` string.
 */
export type TaskSession = {
  id: string;
  startedAt: number;
  updatedAt: number;
  /**
   * What the interviewer asked the candidate to perform.
   * May originate from voice, text, screenshot context, document, or conversation.
   * Null until a brief is known — never assumes coding.
   */
  taskBrief: string | null;
  /** Free-form environment observations (editor, dashboard, notebook, …). */
  environmentHints: string[];
  visibleArtifacts: VisibleArtifact[];
  /** Compact progress / change notes for later AI requests. */
  progressNotes: string[];
  lastFrames: TaskFrameRef[];
  guidanceHistory: TaskGuidanceEntry[];
};

/**
 * Structured intermediate shape for building AI taskContext later.
 * Do not POST this object raw — stringify/budget into `TaskContext` first.
 */
export type TaskContextDraft = {
  taskBrief?: string;
  environmentHints?: string[];
  /** Artifact summaries only (no raw screen payloads). */
  visibleArtifacts?: string[];
  progressNotes?: string[];
  recentGuidance?: string[];
};

/** Compact AI-facing task context sent on analyze requests (optional). */
export type TaskContext = string;

/**
 * Request/session capability flag — orthogonal to InterviewModeId and AnswerSource.
 * When true, the client intends Interactive / Hands-on fused guidance.
 */
export type InteractiveHandsOnCapability = {
  interactiveHandsOn?: boolean;
};

/** Compile-time guard: session must not grow image payload fields. */
type ForbiddenTaskSessionKeys = "imageBase64" | "image" | "base64" | "pixels";
type AssertNoImagePayloadInTaskSession = Exclude<
  ForbiddenTaskSessionKeys,
  keyof TaskSession
> extends ForbiddenTaskSessionKeys
  ? true
  : never;
const _assertNoImagePayloadInTaskSession: AssertNoImagePayloadInTaskSession = true;
void _assertNoImagePayloadInTaskSession;

export function createTaskSession(partial?: Partial<TaskSession>): TaskSession {
  const now = Date.now();
  return {
    id: partial?.id ?? newTaskSessionId(),
    startedAt: partial?.startedAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
    taskBrief: partial?.taskBrief ?? null,
    environmentHints: partial?.environmentHints ? [...partial.environmentHints] : [],
    visibleArtifacts: partial?.visibleArtifacts ? [...partial.visibleArtifacts] : [],
    progressNotes: partial?.progressNotes ? [...partial.progressNotes] : [],
    lastFrames: partial?.lastFrames ? [...partial.lastFrames] : [],
    guidanceHistory: partial?.guidanceHistory ? [...partial.guidanceHistory] : [],
  };
}

/** Capability is active when a TaskSession exists for the interview. */
export function isInteractiveHandsOnActive(session: TaskSession | null | undefined): boolean {
  return Boolean(session?.id);
}

/** Lightweight fingerprint — never stores image bytes. */
export function hashImageFingerprint(imageBase64: string): string {
  const sample = imageBase64.slice(0, 96);
  let h = 2166136261;
  for (let i = 0; i < sample.length; i += 1) {
    h ^= sample.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= imageBase64.length;
  return (h >>> 0).toString(16);
}

export function frameRefFromCapture(
  imageBase64: string,
  opts?: {
    mimeType?: string;
    localRef?: string;
    reason?: TaskFrameRef["reason"];
  },
): TaskFrameRef {
  return {
    id: newTaskSessionId(),
    capturedAt: Date.now(),
    hash: hashImageFingerprint(imageBase64),
    mimeType: opts?.mimeType ?? "image/jpeg",
    localRef: opts?.localRef ?? "transient-last-capture",
    reason: opts?.reason,
  };
}

/** Append frame metadata (newest first); never stores base64. */
export function recordTaskFrame(
  session: TaskSession,
  imageBase64: string,
  reason?: TaskFrameRef["reason"],
): TaskSession {
  const frame = frameRefFromCapture(imageBase64, { reason });
  return {
    ...session,
    updatedAt: Date.now(),
    lastFrames: [frame, ...session.lastFrames].slice(0, TASK_SESSION_MAX_FRAMES),
  };
}

/** Set brief only when empty — no AI summarization. */
export function setTaskBriefIfEmpty(session: TaskSession, brief: string): TaskSession {
  const trimmed = brief.trim();
  if (!trimmed || session.taskBrief?.trim()) return session;
  return { ...session, updatedAt: Date.now(), taskBrief: trimmed };
}

export function recordTaskGuidance(
  session: TaskSession,
  prompt: string | undefined,
  guidance: string,
): TaskSession {
  const excerpt = guidance.replace(/\s+/g, " ").trim();
  if (!excerpt) return session;
  const entry: TaskGuidanceEntry = {
    id: newTaskSessionId(),
    at: Date.now(),
    prompt: prompt?.trim() || undefined,
    guidance:
      excerpt.length > TASK_GUIDANCE_EXCERPT_CHARS
        ? `${excerpt.slice(0, TASK_GUIDANCE_EXCERPT_CHARS)}…`
        : excerpt,
  };
  return {
    ...session,
    updatedAt: Date.now(),
    guidanceHistory: [entry, ...session.guidanceHistory].slice(0, TASK_SESSION_MAX_GUIDANCE),
  };
}

/**
 * Compact AI-facing taskContext string from TaskSession.
 * Delegates to the deterministic Step 6 builder (ordering + budgets).
 * Kept for backward-compatible imports.
 */
export function formatTaskContext(session: TaskSession | null | undefined): TaskContext | undefined {
  // Lazy require-style call via dynamic import is awkward in sync code;
  // duplicate thin call site: prefer buildFormattedTaskContext from interactiveTaskContext.
  // Implementation inlined to avoid circular imports with interactiveTaskContext.
  if (!session) return undefined;
  const preamble =
    "CONTEXT DATA (continuity only — current interviewer ask and current screen override if newer):";
  const sections: string[] = [preamble];
  if (session.taskBrief?.trim()) {
    sections.push(`CURRENT TASK:\n${session.taskBrief.trim().slice(0, 600)}`);
  }
  if (session.environmentHints.length) {
    sections.push(
      `ENVIRONMENT HINTS:\n${session.environmentHints
        .slice(0, 6)
        .map((h) => `- ${h}`)
        .join("\n")}`,
    );
  }
  if (session.visibleArtifacts.length) {
    sections.push(
      `VISIBLE ARTIFACTS:\n${session.visibleArtifacts
        .slice(0, 6)
        .map((a) => `- ${a.summary}`)
        .join("\n")}`,
    );
  }
  if (session.progressNotes.length) {
    sections.push(
      `RECENT PROGRESS:\n${session.progressNotes
        .slice(0, 10)
        .map((n) => `- ${n}`)
        .join("\n")}`,
    );
  }
  if (session.lastFrames.length) {
    sections.push(
      `RECENT SCREEN REFS:\n${session.lastFrames
        .slice(0, 3)
        .map((f) => {
          const parts = [
            f.reason ? `reason=${f.reason}` : null,
            f.hash ? `hash=${f.hash}` : null,
            f.capturedAt ? `at=${new Date(f.capturedAt).toISOString()}` : null,
          ].filter(Boolean);
          return `- ${parts.join(" ")}`;
        })
        .join("\n")}`,
    );
  }
  if (session.guidanceHistory.length) {
    const recent = session.guidanceHistory.slice(0, 4);
    sections.push(
      `RECENT GUIDANCE:\n${recent
        .map((g) => (g.prompt ? `- (${g.prompt}) ${g.guidance}` : `- ${g.guidance}`))
        .join("\n")}`,
    );
  }
  if (sections.length <= 1) return undefined;
  const text = sections.join("\n\n");
  const budget = Math.min(4000, TASK_CONTEXT_MAX_CHARS);
  return text.length > budget ? `${text.slice(0, budget - 1)}…` : text;
}

function newTaskSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
