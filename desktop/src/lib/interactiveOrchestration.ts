/**
 * Pure Interactive / Hands-on orchestration helpers (desktop Step 4–6).
 * Keeps TaskSession free of image bytes; fuse logic is testable without React.
 */
import type { InteractiveCaptureReason } from "./interactiveCapture";
import { isValidCapturePayload } from "./interactiveCapture";
import {
  appendFrameMetadata,
  applyInteractiveAnswerToContext,
  buildFormattedTaskContext,
  initializeInteractiveTaskSession,
} from "./interactiveTaskContext";
import type { AnswerSource } from "./types";
import type { TaskSession } from "./taskSession";

export type InteractiveTransientState = {
  interactiveHandsOn: boolean;
  taskSession: TaskSession | null;
  /** Latest capture lives outside TaskSession (may be shared with normal screenshot slot). */
  latestImageBase64: string | null;
  screenshotPending: boolean;
};

export function createIdleInteractiveState(): InteractiveTransientState {
  return {
    interactiveHandsOn: false,
    taskSession: null,
    latestImageBase64: null,
    screenshotPending: false,
  };
}

export function enableInteractiveHandsOn(
  state: InteractiveTransientState,
): InteractiveTransientState {
  let session = initializeInteractiveTaskSession();
  if (state.latestImageBase64 && isValidCapturePayload(state.latestImageBase64)) {
    session = appendFrameMetadata(session, state.latestImageBase64, "activation", {
      force: true,
    });
  }
  return {
    ...state,
    interactiveHandsOn: true,
    taskSession: session,
  };
}

export function disableInteractiveHandsOn(): InteractiveTransientState {
  return createIdleInteractiveState();
}

/**
 * Apply a validated capture to Interactive (or normal pending) state.
 * Does not trigger AI. Rejects empty payloads — preserves prior valid image.
 */
export function applyInteractiveCapture(
  state: InteractiveTransientState,
  imageBase64: string,
  reason: InteractiveCaptureReason = "manual",
): InteractiveTransientState {
  if (!isValidCapturePayload(imageBase64)) {
    return state;
  }
  /** Only manual Ctrl+H marks a screenshot-only solve ready — not activation/event refresh. */
  const screenshotPending = reason === "manual" ? true : state.screenshotPending;
  if (!state.interactiveHandsOn || !state.taskSession) {
    return {
      ...state,
      latestImageBase64: imageBase64,
      screenshotPending,
    };
  }
  return {
    ...state,
    latestImageBase64: imageBase64,
    screenshotPending,
    taskSession: appendFrameMetadata(state.taskSession, imageBase64, reason),
  };
}

/**
 * Capture failure: keep Interactive on and preserve prior image/session.
 */
export function preserveInteractiveOnCaptureFailure(
  state: InteractiveTransientState,
): InteractiveTransientState {
  return state;
}

export type InteractiveSolveRequest = {
  questionText?: string;
  imageBase64?: string;
  taskContext?: string;
  interactiveHandsOn?: boolean;
  documentContext?: string;
  documentName?: string;
  source?: AnswerSource;
};

/**
 * Ctrl+H → Ctrl+Enter with no voice/text.
 * Must not set interactiveHandsOn — that prompt asks for clarification
 * instead of answering the on-screen question.
 */
export function buildScreenshotOnlySolveRequest(imageBase64?: string | null): {
  source: "screenshot";
  imageBase64?: string;
} {
  return {
    source: "screenshot",
    imageBase64: imageBase64 || undefined,
  };
}

/**
 * Build analyze payload for an Interactive solve.
 * Image is optional; question may be omitted for screenshot-only Interactive.
 */
export function buildInteractiveSolveRequest(input: {
  questionText?: string;
  latestImageBase64?: string | null;
  /** When true, attach image even if not "pending" (voice/text fuse). */
  attachLatestScreen: boolean;
  session: TaskSession | null;
  documentContext?: string;
  documentName?: string;
  source?: AnswerSource;
}): InteractiveSolveRequest {
  const questionText = input.questionText?.trim() || undefined;
  const imageBase64 =
    input.attachLatestScreen && input.latestImageBase64
      ? input.latestImageBase64
      : undefined;
  return {
    questionText,
    imageBase64,
    taskContext: buildFormattedTaskContext(input.session),
    interactiveHandsOn: true,
    documentContext: input.documentContext,
    documentName: input.documentName,
    source: input.source,
  };
}

/** After a successful Interactive answer — brief + guidance only (local, no AI). */
export function applyInteractiveSolveSuccess(
  session: TaskSession,
  question: string | undefined,
  guidance: string,
): TaskSession {
  return applyInteractiveAnswerToContext(session, question, guidance);
}

/**
 * Interactive Ctrl+Enter priority helper:
 * Voice + pending screen → question path (combine). Screenshot-only only with no spoken ask.
 */
export function interactiveSolveBranch(input: {
  hasChatDraft: boolean;
  hasVoiceOrTextQuestion: boolean;
  hasPendingScreenshot: boolean;
  hasLatestImage: boolean;
}): "chat" | "question" | "screenshot" | "flush" {
  if (input.hasChatDraft) return "chat";
  if (input.hasVoiceOrTextQuestion) return "question";
  if (input.hasPendingScreenshot && input.hasLatestImage) return "screenshot";
  return "flush";
}

/**
 * Attach the latest screenshot onto a spoken question (combine).
 *
 * Canonical order: hear audio first, then Ctrl+H, then Ctrl+Enter.
 * Reverse (Ctrl+H then audio) also fuses while the capture is still pending.
 * Follow-up after a screen answer may reuse that frame.
 * Never hitch a leftover screenshot onto a brand-new independent audio question.
 */
export function shouldFuseVoiceWithScreen(input: {
  hasLatestImage: boolean;
  screenshotPending: boolean;
  isFollowUp: boolean;
  lastSolveHadScreen: boolean;
}): boolean {
  if (!input.hasLatestImage) return false;
  if (input.screenshotPending) return true;
  return input.isFollowUp && input.lastSolveHadScreen;
}
