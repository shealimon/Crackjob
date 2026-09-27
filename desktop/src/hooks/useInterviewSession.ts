import { useCallback, useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { DEMO_USER, FREE_LIMIT_UPGRADE_MSG, FREE_PARTIAL_UPGRADE_MSG } from "../lib/constants";
import {
  analyzeQuestionStream,
  ApiError,
  ensureDesktopSession,
  fetchResume,
  isAbortError,
  mergeAccessIntoUser,
  syncInterviewDays,
  withDesktopSessionRetry,
  type StreamAnalyzeEvent,
} from "../lib/api";
import {
  appendInterviewEntry,
  cleanInterviewDayForSync,
  listUnsyncedInterviewEntries,
  loadInterviewDay,
  markInterviewDaySynced,
  newSessionId,
  unsyncedDates,
} from "../lib/interviewHistory";
import {
  isGenericQuestionLabel,
  shouldAttachConversationContext,
  shouldContinueLastThread,
  isNoiseTranscription,
  isQuestionExtension,
  isSameSpokenQuestion,
  isSubstantialQuestion,
  isTruncatedQuestion,
  isUtteranceContinuation,
  isWhisperHallucination,
  mergeUtterance,
  normalizeUtterance,
  pickDisplayQuestion,
  refersToOnScreenQuestion,
  stripRepeatedQuestion,
} from "../lib/interviewSpeech";
import {
  acceptInteractiveCapturePayload,
  createInteractiveCapturePolicy,
  decideInteractiveCapture,
  disableInteractiveCapturePolicy,
  enableInteractiveCapturePolicy,
  markInteractiveCaptureAccepted,
  type InteractiveCapturePolicy,
  type InteractiveCaptureReason,
} from "../lib/interactiveCapture";
import {
  abortRustCaptureInFlight,
  beginRustCaptureInFlight,
  completeRustCaptureInFlight,
  flushActiveScreenshotCaptures,
  getActiveScreenshot,
  commitActiveScreenshotExternal,
  invalidateActiveScreenshotSession,
  resolveLatestCommittedScreenshot,
  runActiveScreenshotCapture,
} from "../lib/activeScreenshot";
import { desktopActiveScreenshot } from "../lib/activeScreenshotSession";
import {
  applyInteractiveCapture,
  applyInteractiveSolveSuccess,
  buildInteractiveSolveRequest,
  buildScreenshotOnlySolveRequest,
  disableInteractiveHandsOn,
  enableInteractiveHandsOn,
  interactiveSolveBranch,
  preserveInteractiveOnCaptureFailure,
  shouldFuseVoiceWithScreen,
} from "../lib/interactiveOrchestration";
import {
  applyCandidateSubmissionToContext,
  applyInterviewerQuestionToContext,
  appendDocumentNameHint,
  buildFormattedTaskContext,
  initializeInteractiveTaskSession,
} from "../lib/interactiveTaskContext";
import type { TaskSession } from "../lib/taskSession";
import { useAudioTranscription } from "./useAudioTranscription";
import {
  captureScreenshot,
  clearStoredCapture,
  discardAudioChunk,
  hideOverlay,
  loadPrefs,
  quitApp,
  readAudioStatus,
  requestSolve,
  savePrefs,
  setInterviewActive,
  showOverlay,
  startSystemAudio,
  stopSystemAudio,
  toggleOverlay as toggleAppVisibility,
} from "../lib/tauri";
import type { AudioStatus, AnswerEntry, OverlayPayload, Prefs, SolveResult, TranscriptEntry, UserProfile } from "../lib/types";

function emptyResult(): SolveResult {
  return {
    headline: "",
    problemSummary: "",
    approach: [],
    solution: "",
    talkingPoints: [],
    followUps: [],
    pitfalls: [],
  };
}

/** Free explore exhausted — do not call the AI API. */
function isFreeExploreExhausted(user: UserProfile | undefined): boolean {
  if (!user || user.fullAccess) return false;
  const remaining =
    typeof user.exploreRemaining === "number" ? user.exploreRemaining : user.creditBalance;
  return typeof remaining === "number" && remaining <= 0;
}

export function useInterviewSession() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [user, setUser] = useState<UserProfile>({ ...DEMO_USER });
  const [needsLogin, setNeedsLogin] = useState(false);
  const [interviewStarting, setInterviewStarting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlayOn, setOverlayOn] = useState(false);
  const [interviewOn, setInterviewOn] = useState(false);
  const [lastResult, setLastResult] = useState<SolveResult | null>(null);
  const [audio, setAudio] = useState<AudioStatus | null>(null);
  const [audioHearing, setAudioHearing] = useState(false);
  const [audioTranscribing, setAudioTranscribing] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [boot, setBoot] = useState("Loading…");
  const [interactiveHandsOn, setInteractiveHandsOn] = useState(false);

  const prefsRef = useRef(prefs);
  const userRef = useRef(user);
  const lastResultRef = useRef(lastResult);
  const lastCaptureRef = useRef<string | null>(null);
  const activeScreenshotRef = useRef(desktopActiveScreenshot);
  const screenshotPendingRef = useRef(false);
  const interactiveHandsOnRef = useRef(false);
  const taskSessionRef = useRef<TaskSession | null>(null);
  const interactiveCapturePolicyRef = useRef<InteractiveCapturePolicy>(
    createInteractiveCapturePolicy(),
  );
  const analyzingRef = useRef(false);
  const transcriptsRef = useRef<TranscriptEntry[]>([]);
  const answerHistoryRef = useRef<AnswerEntry[]>([]);
  /** Same interview across Start/Stop until logout/quit. */
  const interviewSessionIdRef = useRef<string | null>(null);
  const interviewSessionStartedAtRef = useRef<string | null>(null);
  const analyzeGenerationRef = useRef(0);
  const analyzeAbortRef = useRef<AbortController | null>(null);
  const interviewOnRef = useRef(interviewOn);
  prefsRef.current = prefs;
  userRef.current = user;
  lastResultRef.current = lastResult;
  transcriptsRef.current = transcripts;
  interviewOnRef.current = interviewOn;
  interactiveHandsOnRef.current = interactiveHandsOn;

  const clearInteractiveState = useCallback(() => {
    const cleared = disableInteractiveHandsOn();
    interactiveHandsOnRef.current = false;
    setInteractiveHandsOn(false);
    taskSessionRef.current = cleared.taskSession;
    invalidateActiveScreenshotSession(activeScreenshotRef.current);
    lastCaptureRef.current = cleared.latestImageBase64;
    screenshotPendingRef.current = cleared.screenshotPending;
    interactiveCapturePolicyRef.current = disableInteractiveCapturePolicy();
    void clearStoredCapture().catch(() => undefined);
  }, []);

  const audioRef = useRef<AudioStatus | null>(null);
  audioRef.current = audio;

  const audioHearingRef = useRef(false);
  const audioTranscribingRef = useRef(false);
  /** Last time we heard speech / had buffered audio — used for early Ctrl+Enter. */
  const lastAudioActivityAtRef = useRef(0);

  const applyScreenshotContext = useCallback(
    (imageBase64: string, reason: InteractiveCaptureReason = "manual") => {
      const next = applyInteractiveCapture(
        {
          interactiveHandsOn: interactiveHandsOnRef.current,
          taskSession: taskSessionRef.current,
          latestImageBase64: lastCaptureRef.current,
          screenshotPending: screenshotPendingRef.current,
        },
        imageBase64,
        reason,
      );
      lastCaptureRef.current = next.latestImageBase64;
      screenshotPendingRef.current = next.screenshotPending;
      if (next.taskSession) taskSessionRef.current = next.taskSession;
      if (interactiveHandsOnRef.current && next.latestImageBase64 === imageBase64) {
        interactiveCapturePolicyRef.current = markInteractiveCaptureAccepted(
          interactiveCapturePolicyRef.current,
          imageBase64,
        );
      }
    },
    [],
  );

  const holdScreenshot = useCallback(
    (
      imageBase64: string,
      reason: InteractiveCaptureReason = "manual",
      opts?: { skipCommit?: boolean },
    ) => {
      if (!opts?.skipCommit) {
        const { accepted } = commitActiveScreenshotExternal(
          activeScreenshotRef.current,
          imageBase64,
        );
        if (!accepted) return;
      } else if (getActiveScreenshot(activeScreenshotRef.current) !== imageBase64) {
        // capture-ready was not committed (stale dedupe / invalidated) — do not overwrite slot.
        return;
      }
      lastCaptureRef.current = getActiveScreenshot(activeScreenshotRef.current);
      applyScreenshotContext(imageBase64, reason);
      if (reason === "manual") {
        void emit("screenshot-captured").catch(() => undefined);
      }
    },
    [applyScreenshotContext],
  );

  const overlayMeta = useCallback(
    () =>
      ({
        transcripts: transcriptsRef.current,
        listening: interviewOnRef.current && !audioPausedRef.current,
        audioHearing: audioHearingRef.current,
        audioTranscribing: audioTranscribingRef.current,
        audioStatus: audioRef.current,
        answerHistory: answerHistoryRef.current,
        screenshotPending: screenshotPendingRef.current,
        interactiveHandsOn: interactiveHandsOnRef.current,
      }) as const,
    [],
  );

  /** Serialize emits; always re-read answer/transcript refs last so stale pushes cannot wipe a live Q. */
  const overlayChainRef = useRef(Promise.resolve());
  const pushOverlay = useCallback((payload: OverlayPayload) => {
    const run = async () => {
      await emit("overlay-update", {
        ...overlayMeta(),
        ...payload,
        answerHistory: answerHistoryRef.current,
        transcripts: transcriptsRef.current,
        listening: interviewOnRef.current && !audioPausedRef.current,
        audioHearing: audioHearingRef.current,
        audioTranscribing: audioTranscribingRef.current,
        screenshotPending: screenshotPendingRef.current,
      });
    };
    const next = overlayChainRef.current.then(run, run);
    overlayChainRef.current = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }, [overlayMeta]);

  /**
   * Assisted Interactive refresh — capture only, never solves / never spends credits.
   * Debounced unless force or manual. Failures keep the prior valid screenshot.
   */
  const refreshInteractiveScreen = useCallback(
    async (
      reason: InteractiveCaptureReason,
      opts?: { force?: boolean },
    ): Promise<"captured" | "skipped" | "failed" | "inactive"> => {
      if (!interviewOnRef.current || !interactiveHandsOnRef.current) {
        return "inactive";
      }
      const gate = decideInteractiveCapture(
        interactiveCapturePolicyRef.current,
        reason,
        Date.now(),
        { force: opts?.force },
      );
      if (!gate.allow) return "skipped";

      try {
        const imageBase64 = await runActiveScreenshotCapture(
          activeScreenshotRef.current,
          async () => captureScreenshot(),
        );
        if (!imageBase64) {
          preserveInteractiveOnCaptureFailure({
            interactiveHandsOn: true,
            taskSession: taskSessionRef.current,
            latestImageBase64: lastCaptureRef.current,
            screenshotPending: screenshotPendingRef.current,
          });
          return "failed";
        }
        const accept = acceptInteractiveCapturePayload(
          interactiveCapturePolicyRef.current,
          imageBase64,
          reason,
          { force: opts?.force },
        );
        if (!accept.allow) {
          preserveInteractiveOnCaptureFailure({
            interactiveHandsOn: true,
            taskSession: taskSessionRef.current,
            latestImageBase64: lastCaptureRef.current,
            screenshotPending: screenshotPendingRef.current,
          });
          return "skipped";
        }
        holdScreenshot(imageBase64, reason, { skipCommit: true });
        const current = prefsRef.current;
        if (current) {
          void pushOverlay({
            mode: current.mode,
            companyPack: current.companyPack,
            hasScreenshot: true,
            creditBalance: userRef.current?.creditBalance,
            ...overlayMeta(),
          });
        }
        return "captured";
      } catch (err) {
        preserveInteractiveOnCaptureFailure({
          interactiveHandsOn: true,
          taskSession: taskSessionRef.current,
          latestImageBase64: lastCaptureRef.current,
          screenshotPending: screenshotPendingRef.current,
        });
        if (reason === "manual" || reason === "activation") {
          setError(err instanceof Error ? err.message : "Screen refresh failed");
        }
        return "failed";
      }
    },
    [holdScreenshot, overlayMeta, pushOverlay],
  );

  const refreshInteractiveScreenRef = useRef(refreshInteractiveScreen);
  refreshInteractiveScreenRef.current = refreshInteractiveScreen;

  /** Unified interview engine: Interactive capability + TaskSession (no separate Live toggle). */
  const enableUnifiedInterviewSession = useCallback(() => {
    if (!interviewOnRef.current) return;
    const next = enableInteractiveHandsOn({
      interactiveHandsOn: false,
      taskSession: null,
      latestImageBase64: lastCaptureRef.current,
      screenshotPending: screenshotPendingRef.current,
    });
    interactiveHandsOnRef.current = true;
    setInteractiveHandsOn(true);
    taskSessionRef.current = next.taskSession;
    interactiveCapturePolicyRef.current = enableInteractiveCapturePolicy(
      interactiveCapturePolicyRef.current,
    );
    if (next.latestImageBase64) {
      lastCaptureRef.current = next.latestImageBase64;
      interactiveCapturePolicyRef.current = markInteractiveCaptureAccepted(
        interactiveCapturePolicyRef.current,
        next.latestImageBase64,
      );
    }
    void refreshInteractiveScreenRef.current("activation", { force: true });
  }, []);

  const syncResumeFromCloud = useCallback(async (current: Prefs) => {
    if (!current.token) return current;
    try {
      const cloud = await fetchResume(current);
      if (!cloud.resumeText) return current;
      // Prefer longer cloud resume when local is empty or clearly shorter (website upload).
      if (
        !current.resumeText.trim() ||
        cloud.resumeText.length > current.resumeText.trim().length + 200
      ) {
        const merged = { ...current, resumeText: cloud.resumeText.slice(0, 8000) };
        setPrefs(merged);
        prefsRef.current = merged;
        await savePrefs(merged);
        return merged;
      }
    } catch {
      // Keep local resume if cloud sync fails.
    }
    return current;
  }, []);

  const persist = useCallback(async (next: Prefs) => {
    const current = prefsRef.current;
    const merged = {
      ...next,
      rememberMe: next.rememberMe ?? current?.rememberMe ?? false,
      rememberedEmail:
        next.rememberedEmail ?? current?.rememberedEmail ?? "",
      rememberedPassword:
        next.rememberedPassword ?? current?.rememberedPassword ?? "",
    };
    setPrefs(merged);
    prefsRef.current = merged;
    await savePrefs(merged);
  }, []);

  const requireInterview = useCallback((action: string) => {
    if (interviewOnRef.current) return true;
    setError(`Click Start to begin the interview before ${action}.`);
    return false;
  }, []);

  const lastAudioQuestionRef = useRef<string | null>(null);
  const lastAudioQuestionTextRef = useRef<string | null>(null);
  const lastVoiceAnsweredAtRef = useRef(0);
  const liveDraftIdRef = useRef<string | null>(null);
  const lastScreenshotSolveAtRef = useRef(0);
  /** Last unanswered spoken question — survives Ctrl+H so audio→screenshot combine works. */
  const heldCombineVoiceRef = useRef<{ text: string; at: number } | null>(null);
  /** Last completed/started solve attached a screenshot — follow-ups may fuse that frame. */
  const lastSolveHadScreenRef = useRef(false);
  /** Image currently in-flight for screenshot solve — Ctrl+Enter must not abort/restart it. */
  const analyzingShotRef = useRef<string | null>(null);
  /** Pasted/typed chat question from overlay composer — preferred by Ctrl+Enter. */
  const chatDraftRef = useRef("");
  /** Attached interviewer document for chat/paste answers. */
  const chatDocumentRef = useRef<{ name: string; text: string } | null>(null);
  /** Guard against global + window Ctrl+Enter both firing for the same paste. */
  const lastChatSolveAtRef = useRef(0);
  const audioPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [audioPaused, setAudioPaused] = useState(false);
  const audioPausedRef = useRef(audioPaused);
  audioPausedRef.current = audioPaused;
  const [audioResetEpoch, setAudioResetEpoch] = useState(0);
  const [audioInterruptEpoch, setAudioInterruptEpoch] = useState(0);
  const bumpAudioReset = useCallback(() => {
    setAudioResetEpoch((n) => n + 1);
  }, []);
  const interruptAudio = useCallback(() => {
    setAudioInterruptEpoch((n) => n + 1);
  }, []);

  useEffect(() => {
    return () => {
      if (audioPauseTimerRef.current) clearTimeout(audioPauseTimerRef.current);
    };
  }, []);

  // Audio stays on even with a pending screenshot — capture ≠ execute for voice.
  // Ctrl+H stores the image only. Ctrl+Enter runs the screenshot solve.
  // Ctrl+Enter answers voice drafts, or focuses an in-flight screenshot solve.
  const [audioAnsweredEpoch, setAudioAnsweredEpoch] = useState(0);
  const [audioAnsweredText, setAudioAnsweredText] = useState<string | null>(null);
  /** Bump to force-flush buffered speech when Ctrl+Enter arrives before STT text. */
  const [audioFlushEpoch, setAudioFlushEpoch] = useState(0);
  /** Ctrl+Enter armed before question text exists — auto-answer when STT lands. */
  const pendingVoiceSolveRef = useRef<number | null>(null);
  const PENDING_VOICE_SOLVE_MS = 20_000;
  /** In-memory STT text — available before overlay paint. */
  const liveAudioTextRef = useRef("");
  const answerVoiceQuestionRef = useRef<
    (question: string, existingEntryId?: string, force?: boolean) => boolean
  >(() => false);
  const markVoiceAnswered = useCallback((question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    lastAudioQuestionRef.current = normalizeUtterance(trimmed);
    lastAudioQuestionTextRef.current = trimmed;
    lastVoiceAnsweredAtRef.current = Date.now();
    liveAudioTextRef.current = "";
    heldCombineVoiceRef.current = null;
    // Drop leftover PCM from the question we just answered so the next ask
    // (and the next Ctrl+Enter) cannot re-transcribe / re-solve the old one.
    void discardAudioChunk(0).catch(() => undefined);
    setAudioAnsweredText(trimmed);
    setAudioAnsweredEpoch((n) => n + 1);
  }, []);

  const buildConversationContext = useCallback((_newQuestion?: string) => {
    const entries = answerHistoryRef.current
      .filter(
        (entry) =>
          !entry.streaming &&
          !entry.questionStreaming &&
          entry.result.solution.trim() &&
          !isGenericQuestionLabel(entry.question),
      )
      // Only the latest answered Q&A — older threads were bleeding into follow-ups.
      .slice(0, 1);
    if (!entries.length) return undefined;

    const lines = [
      "PRIOR Q&A (latest topic only — the new ask continues THIS thread; answer only what was just asked; ignore any older unrelated problems):",
    ];
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      const maxChars = 2200;
      lines.push(`Q: ${entry.question}`);
      const compact = entry.result.solution.replace(/\s+/g, " ").trim();
      lines.push(`A: ${compact.length > maxChars ? `${compact.slice(0, maxChars)}…` : compact}`);
      lines.push("");
    }
    return lines.join("\n").trim();
  }, []);

  const upsertLiveQuestion = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      // Show whatever STT produced in the Q section — answer waits for Ctrl+Enter.
      if (!trimmed || isWhisperHallucination(trimmed)) return;
      const current = prefsRef.current;
      if (!current) return;
      heldCombineVoiceRef.current = { text: trimmed, at: Date.now() };

      const isStaleAnswered = () => {
        const key = normalizeUtterance(trimmed);
        if (key && key === lastAudioQuestionRef.current) return true;
        if (
          lastAudioQuestionTextRef.current &&
          isSameSpokenQuestion(trimmed, lastAudioQuestionTextRef.current)
        ) {
          return true;
        }
        return answerHistoryRef.current.some(
          (entry) =>
            entry.source !== "screenshot" &&
            normalizeUtterance(entry.question) === key &&
            entry.result.solution.trim().length > 0 &&
            !entry.questionStreaming &&
            !entry.streaming,
        );
      };

      const draftId = liveDraftIdRef.current;
      const existingDraft = draftId
        ? answerHistoryRef.current.find((entry) => entry.id === draftId && entry.questionStreaming)
        : null;

      // Only auto-answer when user already pressed Ctrl+Enter (pending), never on STT alone.
      const canAutoAnswerPending = (text: string) => {
        if (isStaleAnswered()) return false;
        const t = text.trim();
        if (!t || t.length < 6) return false;
        if (isWhisperHallucination(t) || isNoiseTranscription(t)) return false;
        return true;
      };

      if (existingDraft) {
        if (normalizeUtterance(trimmed) === normalizeUtterance(existingDraft.question)) {
          const pendingAt = pendingVoiceSolveRef.current;
          if (
            pendingAt &&
            Date.now() - pendingAt < PENDING_VOICE_SOLVE_MS &&
            canAutoAnswerPending(trimmed)
          ) {
            pendingVoiceSolveRef.current = null;
            queueMicrotask(() => {
              answerVoiceQuestionRef.current(trimmed, draftId ?? undefined, true);
            });
          }
          return;
        }
        answerHistoryRef.current = answerHistoryRef.current.map((entry) =>
          entry.id === draftId ? { ...entry, question: trimmed } : entry,
        );
      } else {
        const id = `draft-${Date.now()}`;
        liveDraftIdRef.current = id;
        answerHistoryRef.current = [
          {
            id,
            question: trimmed,
            result: emptyResult(),
            at: Date.now(),
            questionStreaming: true,
            source: "voice" as const,
          },
          ...answerHistoryRef.current.filter((entry) => !entry.questionStreaming),
        ].slice(0, 50);
      }

      void showOverlay().catch(() => undefined);
      setOverlayOn(true);
      setError(null);
      void pushOverlay({
        mode: current.mode,
        companyPack: current.companyPack,
        focusResponse: true,
        error: null,
        creditBalance: userRef.current?.creditBalance,
        hasScreenshot: Boolean(lastCaptureRef.current),
        ...overlayMeta(),
      });

      // Ctrl+Enter was pressed early — answer once STT text is ready (not before).
      const pendingAt = pendingVoiceSolveRef.current;
      if (
        pendingAt &&
        Date.now() - pendingAt < PENDING_VOICE_SOLVE_MS &&
        canAutoAnswerPending(trimmed)
      ) {
        pendingVoiceSolveRef.current = null;
        const id = liveDraftIdRef.current;
        queueMicrotask(() => {
          answerVoiceQuestionRef.current(trimmed, id ?? undefined, true);
        });
      }
    },
    [overlayMeta, pushOverlay],
  );

  const onUtteranceReady = useCallback(
    (question: string) => {
      liveAudioTextRef.current = question;
      if (question.trim() && !isWhisperHallucination(question)) {
        heldCombineVoiceRef.current = { text: question.trim(), at: Date.now() };
      }
      // Early Ctrl+Enter: STT may land before overlay canShow gate — still consume pending.
      const pendingAt = pendingVoiceSolveRef.current;
      if (!pendingAt || Date.now() - pendingAt >= PENDING_VOICE_SOLVE_MS) return;
      upsertLiveQuestion(question);
    },
    [upsertLiveQuestion],
  );

  const runAnalyze = useCallback(
    async (input: {
      questionText?: string;
      imageBase64?: string;
      existingEntryId?: string;
      source?: AnswerEntry["source"];
      documentContext?: string;
      documentName?: string;
      taskContext?: string;
      interactiveHandsOn?: boolean;
    }) => {
      const current = prefsRef.current;
      if (!current) return;

      const { imageBase64: slotImage } = await resolveLatestCommittedScreenshot(
        activeScreenshotRef.current,
      );
      // Voice stays text-only unless the caller explicitly fused a screenshot
      // (Ctrl+H + spoken ask, or a follow-up on the last on-screen question).
      // Do not auto-hitch leftover slot bytes onto every audio turn.
      const attachScreen =
        input.source !== "voice" &&
        (!input.questionText?.trim() || Boolean(input.interactiveHandsOn));
      const resolvedImageBase64 = attachScreen
        ? slotImage ?? input.imageBase64 ?? undefined
        : input.imageBase64;
      if (resolvedImageBase64) {
        lastCaptureRef.current = resolvedImageBase64;
      }

      const isScreenshot = Boolean(resolvedImageBase64) && !input.questionText?.trim();
      // Debounce rapid Ctrl+Enter / dual hotkey solves (keep short so re-press feels snappy).
      if (isScreenshot && !input.existingEntryId) {
        const now = Date.now();
        if (now - lastScreenshotSolveAtRef.current < 400) return;
        lastScreenshotSolveAtRef.current = now;
      }

      if (!interviewOnRef.current) {
        setError("Click Start to begin the interview first.");
        return;
      }

      if (isFreeExploreExhausted(userRef.current)) {
        const message = FREE_LIMIT_UPGRADE_MSG;
        setError(message);
        void showOverlay().catch(() => undefined);
        setOverlayOn(true);
        void pushOverlay({
          mode: current.mode,
          companyPack: current.companyPack,
          analyzing: false,
          streaming: false,
          error: message,
          creditBalance: userRef.current?.creditBalance ?? 0,
          result: lastResultRef.current,
          hasScreenshot: Boolean(lastCaptureRef.current),
          upgradeRequired: true,
          upgradePrompt: message,
          partialAnswer: false,
          ...overlayMeta(),
        });
        return;
      }

      const priorSolveHadScreen = lastSolveHadScreenRef.current;
      lastSolveHadScreenRef.current = Boolean(resolvedImageBase64);

      if (isScreenshot) {
        screenshotPendingRef.current = false;
        analyzingShotRef.current = resolvedImageBase64 || null;
        liveDraftIdRef.current = null;
        // Leftover STT from before this screenshot-only solve must not answer the next audio Q.
        liveAudioTextRef.current = "";
        pendingVoiceSolveRef.current = null;
        heldCombineVoiceRef.current = null;
        // Drop in-flight STT for this beat only — do not pause the audio loop.
        interruptAudio();
        void discardAudioChunk(0).catch(() => undefined);
      } else {
        analyzingShotRef.current = null;
        // Interactive voice/text+screen fuse: clear pending so next Ctrl+Enter
        // does not fall into screenshot-only, but keep lastCapture for later fuses.
        if (input.interactiveHandsOn && resolvedImageBase64) {
          screenshotPendingRef.current = false;
        }
      }
      // Audio answer must NOT clear a pending screenshot — Ctrl+Enter can still run after.

      const generation = ++analyzeGenerationRef.current;
      analyzeAbortRef.current?.abort();
      const abortController = new AbortController();
      analyzeAbortRef.current = abortController;

      const questionLabel =
        input.questionText?.trim() || (resolvedImageBase64 ? "" : "Question");

      const reusable =
        !isScreenshot && !input.existingEntryId
          ? answerHistoryRef.current.find(
              (entry) =>
                (entry.streaming || entry.questionStreaming) &&
                !entry.result.solution.trim() &&
                !isGenericQuestionLabel(entry.question) &&
                Boolean(input.questionText) &&
                normalizeUtterance(entry.question) === normalizeUtterance(input.questionText || ""),
            )
          : null;

      const answerId = input.existingEntryId ?? reusable?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      answerHistoryRef.current = answerHistoryRef.current.filter((entry) => {
        if (entry.id === answerId) return true;
        if ((entry.streaming || entry.questionStreaming) && !entry.result.solution.trim()) return false;
        if (isGenericQuestionLabel(entry.question) && !entry.result.solution.trim()) return false;
        return true;
      });

      const answerSource: AnswerEntry["source"] =
        input.source ?? (isScreenshot ? "screenshot" : "voice");
      const isInteractiveSolve = Boolean(input.interactiveHandsOn);

      if (input.existingEntryId || reusable) {
        answerHistoryRef.current = answerHistoryRef.current.map((entry) =>
          entry.id === answerId
            ? {
                ...entry,
                question: questionLabel,
                result: emptyResult(),
                questionStreaming: false,
                streaming: true,
                source: entry.source ?? answerSource,
                interactiveHandsOn: isInteractiveSolve || entry.interactiveHandsOn,
              }
            : entry,
        );
        liveDraftIdRef.current = null;
      } else {
        const newEntry: AnswerEntry = {
          id: answerId,
          question: questionLabel,
          result: emptyResult(),
          at: Date.now(),
          streaming: true,
          source: answerSource,
          interactiveHandsOn: isInteractiveSolve || undefined,
        };
        answerHistoryRef.current = [newEntry, ...answerHistoryRef.current].slice(0, 50);
      }

      const priorAnswered = answerHistoryRef.current.find(
        (entry) =>
          entry.id !== answerId &&
          !entry.streaming &&
          !entry.questionStreaming &&
          entry.result.solution.trim() &&
          !isGenericQuestionLabel(entry.question),
      );
      const priorAnsweredQuestion = priorAnswered?.question;
      const audioQuestion = input.questionText?.trim() || "";
      const isVoiceTurn = input.source === "voice" || (Boolean(audioQuestion) && !isScreenshot);
      // Never attach prior screenshot Q&A to a new independent spoken question —
      // that re-solved the old on-screen problem instead of the new audio ask.
      const isFollowUpTurn = shouldAttachConversationContext({
        questionText: audioQuestion,
        priorQuestion: priorAnsweredQuestion,
        lastSolveHadScreen: priorSolveHadScreen,
      });
      const shouldUseConversationContext = isFollowUpTurn;
      const shouldSendTaskContext =
        Boolean(input.taskContext) ||
        (isInteractiveSolve && !isScreenshot && (!isVoiceTurn || isFollowUpTurn));

      analyzingRef.current = true;
      setAnalyzing(true);
      setError(null);
      // Fire overlay UI without blocking the OpenAI request (saves ~50–150ms TTFT).
      void showOverlay().catch(() => undefined);
      setOverlayOn(true);
      // Prepare request body before overlay IPC; fetch starts next (overlay is fire-and-forget).
      // Chat/paste: never attach resume. Voice/audio: always send resume (HR / projects).
      // Screenshot / Interactive: omit resume (vision TTFT + hands-on focus).
      const resume = current.resumeText?.trim() || "";
      const isChatPaste = input.source === "text";
      const resumeContext =
        !isScreenshot && !isChatPaste && !isInteractiveSolve && resume
          ? resume.length > 8000
            ? resume.slice(0, 8000)
            : resume
          : undefined;
      const analyzeInput = {
        mode: current.mode,
        companyPack: current.companyPack,
        questionText: input.questionText,
        imageBase64: resolvedImageBase64,
        source: input.source,
        extraContext: resumeContext,
        documentContext: input.documentContext,
        documentName: input.documentName,
        taskContext: shouldSendTaskContext
          ? input.taskContext ??
            (isInteractiveSolve ? buildFormattedTaskContext(taskSessionRef.current) : undefined)
          : undefined,
        interactiveHandsOn: isInteractiveSolve || undefined,
        conversationContext: shouldUseConversationContext
          ? buildConversationContext(audioQuestion)
          : undefined,
      };
      void pushOverlay({
        mode: current.mode,
        companyPack: current.companyPack,
        analyzing: true,
        streaming: false,
        // Clear sticky previous result so screenshot solves don't flash old Q&A.
        result: null,
        error: null,
        focusResponse: true,
        creditBalance: userRef.current?.creditBalance,
        hasScreenshot: Boolean(resolvedImageBase64 || lastCaptureRef.current),
        partialAnswer: false,
        upgradeRequired: false,
        upgradePrompt: null,
        ...overlayMeta(),
      });
      try {
        let firstDeltaPushed = false;
        let pendingDeltaOverlay: Parameters<typeof pushOverlay>[0] | null = null;
        let deltaFlushTimer: number | null = null;
        const onEvent = (event: StreamAnalyzeEvent) => {
          if (generation !== analyzeGenerationRef.current) return;
          if (event.type === "start") return;

          if (event.type !== "delta" && event.type !== "done") return;

          const question =
            input.questionText?.trim() ||
            (resolvedImageBase64
              ? pickDisplayQuestion(questionLabel, event.result.headline || event.result.problemSummary)
              : questionLabel);
          const partialAnswer = Boolean(event.partialAnswer);
          const upgradePrompt =
            event.upgradePrompt ?? (partialAnswer ? FREE_PARTIAL_UPGRADE_MSG : null);
          const result = {
            ...event.result,
            headline: question,
            solution: stripRepeatedQuestion(event.result.solution, question),
          };
          if (generation !== analyzeGenerationRef.current) return;
          answerHistoryRef.current = answerHistoryRef.current.map((entry) =>
            entry.id === answerId
              ? {
                  ...entry,
                  question,
                  questionStreaming: false,
                  result,
                  streaming: event.type === "delta",
                  partialAnswer,
                  upgradePrompt,
                }
              : entry,
          );
          setLastResult(result);
          lastResultRef.current = result;
          const creditBalance =
            event.type === "done" ? event.creditBalance : userRef.current?.creditBalance;
          // First tokens: push immediately. Later deltas coalesce so IPC can't backlog.
          if (event.type === "delta") {
            pendingDeltaOverlay = {
              mode: current.mode,
              companyPack: current.companyPack,
              analyzing: false,
              streaming: true,
              result,
              creditBalance,
              hasScreenshot: Boolean(resolvedImageBase64 || lastCaptureRef.current),
              partialAnswer,
              upgradePrompt,
              upgradeRequired: partialAnswer,
              ...overlayMeta(),
            };
            if (!firstDeltaPushed) {
              firstDeltaPushed = true;
              void pushOverlay(pendingDeltaOverlay);
              pendingDeltaOverlay = null;
              return;
            }
            if (deltaFlushTimer == null) {
              deltaFlushTimer = window.setTimeout(() => {
                deltaFlushTimer = null;
                if (!pendingDeltaOverlay || generation !== analyzeGenerationRef.current) return;
                const payload = pendingDeltaOverlay;
                pendingDeltaOverlay = null;
                void pushOverlay(payload);
              }, 32);
            }
            return;
          }
          if (deltaFlushTimer != null) {
            window.clearTimeout(deltaFlushTimer);
            deltaFlushTimer = null;
            pendingDeltaOverlay = null;
          }
          void pushOverlay({
            mode: current.mode,
            companyPack: current.companyPack,
            analyzing: false,
            streaming: false,
            result,
            creditBalance,
            hasScreenshot: Boolean(resolvedImageBase64 || lastCaptureRef.current),
            creditsUsed: event.creditsUsed,
            creditsLow: event.creditsLow,
            usage: event.usage,
            partialAnswer,
            upgradePrompt,
            upgradeRequired: partialAnswer,
            ...overlayMeta(),
          });
        };

        const { result: response, prefs: authedPrefs, user: refreshedUser } =
          await withDesktopSessionRetry(current, (sessionPrefs) =>
            analyzeQuestionStream(sessionPrefs, analyzeInput, onEvent, abortController.signal),
          );
        if (authedPrefs.token !== current.token) {
          prefsRef.current = authedPrefs;
          setPrefs(authedPrefs);
          void savePrefs(authedPrefs);
        }
        if (refreshedUser) {
          setUser(refreshedUser);
          userRef.current = refreshedUser;
        }
        if (generation !== analyzeGenerationRef.current) {
          answerHistoryRef.current = answerHistoryRef.current.filter(
            (entry) => entry.id !== answerId || entry.result.solution.trim().length > 0,
          );
          return;
        }
        setLastResult(response.result);
        const partialAnswer = Boolean(response.partialAnswer);
        const upgradePrompt =
          response.upgradePrompt ?? (partialAnswer ? FREE_PARTIAL_UPGRADE_MSG : null);
        setUser((profile) => {
          const next = mergeAccessIntoUser(profile, {
            creditBalance: response.creditBalance,
            creditsLow: response.creditsLow,
            exploreRemaining: response.exploreRemaining ?? response.creditBalance,
            solvesToday: response.solvesToday,
            answerTier: response.answerTier,
            fullAccess: response.fullAccess,
            plan: response.plan,
            planStatus: response.planStatus,
            endsAt: response.endsAt,
          });
          userRef.current = next;
          return next;
        });
        const question =
          input.questionText?.trim() ||
          (resolvedImageBase64
            ? pickDisplayQuestion(
                questionLabel,
                response.result.headline || response.result.problemSummary,
              )
            : questionLabel);
        const result = {
          ...response.result,
          headline: question,
          solution: stripRepeatedQuestion(response.result.solution, question),
        };
        answerHistoryRef.current = answerHistoryRef.current.map((entry) =>
          entry.id === answerId
            ? {
                ...entry,
                question,
                questionStreaming: false,
                result,
                streaming: false,
                partialAnswer,
                upgradePrompt,
                interactiveHandsOn: isInteractiveSolve || entry.interactiveHandsOn,
              }
            : entry,
        );

        if (isInteractiveSolve && taskSessionRef.current && result.solution.trim()) {
          taskSessionRef.current = applyInteractiveSolveSuccess(
            taskSessionRef.current,
            question,
            result.solution,
          );
          // Prepare next turn's screen context — never auto-solves.
          void refreshInteractiveScreenRef.current("answer_complete");
        }

        // Persist Q&A to local daily file (never auto-deleted). DB sync on logout/quit only.
        const sessionId = interviewSessionIdRef.current || newSessionId();
        if (!interviewSessionIdRef.current) {
          interviewSessionIdRef.current = sessionId;
          interviewSessionStartedAtRef.current = new Date().toISOString();
        }
        void appendInterviewEntry({
          sessionId,
          startedAt: interviewSessionStartedAtRef.current || new Date().toISOString(),
          mode: current.mode,
          companyPack: current.companyPack || "",
          entryId: answerId,
          question,
          answer: result.solution,
        }).catch((err) => {
          console.error("[interview-history] append failed", err);
        });

        await pushOverlay({
          mode: current.mode,
          companyPack: current.companyPack,
          analyzing: false,
          streaming: false,
          result,
          creditsUsed: response.creditsUsed,
          creditBalance: response.creditBalance,
          creditsLow: response.creditsLow,
          usage: response.usage,
          hasScreenshot: Boolean(resolvedImageBase64 || lastCaptureRef.current),
          partialAnswer,
          upgradePrompt,
          upgradeRequired: partialAnswer,
          ...overlayMeta(),
        });
      } catch (err) {
        if (isAbortError(err)) return;
        if (generation !== analyzeGenerationRef.current) {
          answerHistoryRef.current = answerHistoryRef.current.filter(
            (entry) => entry.id !== answerId || entry.result.solution.trim().length > 0,
          );
          return;
        }
        const limitHit = err instanceof ApiError && err.status === 402;
        const message = limitHit
          ? FREE_LIMIT_UPGRADE_MSG
          : err instanceof Error
            ? err.message
            : "Analyze failed";
        setError(message);
        if (isScreenshot) screenshotPendingRef.current = true;
        answerHistoryRef.current = answerHistoryRef.current.filter(
          (entry) => entry.id !== answerId || entry.result.solution.trim().length > 0,
        );
        if (err instanceof ApiError && err.status === 401) {
          const cleared = await savePrefs({
            ...current,
            token: null,
            rememberMe: Boolean(current.rememberMe),
            rememberedEmail: current.rememberMe ? current.rememberedEmail || "" : "",
            rememberedPassword: current.rememberMe ? current.rememberedPassword || "" : "",
          });
          prefsRef.current = cleared;
          setPrefs(cleared);
          setUser({ ...DEMO_USER });
          setNeedsLogin(true);
          return;
        }
        if (err instanceof ApiError && (err.status === 402 || typeof err.creditBalance === "number")) {
          setUser((profile) => {
            const next = mergeAccessIntoUser(profile, {
              creditBalance: err.creditBalance ?? 0,
              exploreRemaining:
                err.status === 402 || !profile.fullAccess
                  ? (err.creditBalance ?? 0)
                  : profile.exploreRemaining,
              creditsLow: true,
              answerTier: err.status === 402 ? "blocked" : profile.answerTier,
              fullAccess: err.status === 402 ? false : profile.fullAccess,
            });
            userRef.current = next;
            return next;
          });
        }
        await pushOverlay({
          mode: current.mode,
          companyPack: current.companyPack,
          analyzing: false,
          streaming: false,
          error: message,
          creditBalance: userRef.current?.creditBalance,
          result: lastResultRef.current,
          hasScreenshot: Boolean(lastCaptureRef.current),
          upgradeRequired: limitHit,
          upgradePrompt: limitHit ? message : null,
          partialAnswer: false,
          ...overlayMeta(),
        });
      } finally {
        if (generation === analyzeGenerationRef.current) {
          analyzingRef.current = false;
          setAnalyzing(false);
          if (analyzingShotRef.current && isScreenshot) {
            analyzingShotRef.current = null;
          }
        }
      }
    },
    [pushOverlay, overlayMeta, buildConversationContext, interruptAudio],
  );

  const handleTranscript = useCallback(
    (entry: TranscriptEntry) => {
      setTranscripts((prev) => {
        const last = prev[prev.length - 1];
        const lastRole = last?.role ?? "interviewer";
        const entryRole = entry.role ?? "interviewer";
        const sameSpeaker = lastRole === "interviewer" && entryRole === "interviewer";
        const recent = last ? entry.at - last.at < 20_000 : false;
        const merged =
          last &&
          sameSpeaker &&
          recent &&
          isUtteranceContinuation(last.text, entry.text)
            ? [...prev.slice(0, -1), { ...last, text: mergeUtterance(last.text, entry.text), at: entry.at }]
            : [...prev, entry];
        const next = merged.slice(-40);
        transcriptsRef.current = next;
        return next;
      });
      const current = prefsRef.current;
      if (!current) return;
      void pushOverlay({
        mode: current.mode,
        companyPack: current.companyPack,
        creditBalance: userRef.current?.creditBalance,
        hasScreenshot: Boolean(lastCaptureRef.current),
        ...overlayMeta(),
      });
    },
    [overlayMeta, pushOverlay],
  );

  const handleAudioHearing = useCallback(
    (hearing: boolean) => {
      if (hearing) lastAudioActivityAtRef.current = Date.now();
      if (audioHearingRef.current === hearing) return;
      audioHearingRef.current = hearing;
      setAudioHearing(hearing);
      const current = prefsRef.current;
      if (!current || !interviewOnRef.current) return;
      void pushOverlay({
        mode: current.mode,
        companyPack: current.companyPack,
        creditBalance: userRef.current?.creditBalance,
        hasScreenshot: Boolean(lastCaptureRef.current),
        ...overlayMeta(),
      });
    },
    [overlayMeta, pushOverlay],
  );

  const handleAudioTranscribing = useCallback(
    (busy: boolean) => {
      if (audioTranscribingRef.current === busy) return;
      audioTranscribingRef.current = busy;
      setAudioTranscribing(busy);
      const current = prefsRef.current;
      if (!current || !interviewOnRef.current) return;
      void pushOverlay({
        mode: current.mode,
        companyPack: current.companyPack,
        creditBalance: userRef.current?.creditBalance,
        hasScreenshot: Boolean(lastCaptureRef.current),
        ...overlayMeta(),
      });
    },
    [overlayMeta, pushOverlay],
  );

  const answerVoiceQuestion = useCallback(
    (question: string, existingEntryId?: string, force = false) => {
      const trimmed = question.trim();
      // Ctrl+Enter = answer whatever audio text has accumulated in the Q section so far.
      if (!trimmed || isWhisperHallucination(trimmed)) return false;
      if (trimmed.replace(/\s+/g, " ").trim().length < 4) return false;

      const prevText = lastAudioQuestionTextRef.current;
      const key = normalizeUtterance(trimmed);
      const latestAnsweredQuestion = answerHistoryRef.current.find(
        (entry) =>
          !entry.streaming &&
          !entry.questionStreaming &&
          entry.result.solution.trim() &&
          !isGenericQuestionLabel(entry.question),
      )?.question;
      const holdQuestion = latestAnsweredQuestion || prevText;
      const isFollowUp = shouldContinueLastThread({
        newQuestion: trimmed,
        priorQuestion: holdQuestion,
        lastSolveHadScreen: lastSolveHadScreenRef.current,
      });
      const isExtension = isQuestionExtension(prevText || "", trimmed);
      // Screenshot-extracted headlines must not block a new spoken question.
      const alreadyAnswered = answerHistoryRef.current.some(
        (entry) =>
          entry.source !== "screenshot" &&
          normalizeUtterance(entry.question) === key &&
          entry.result.solution.trim().length > 0 &&
          !entry.questionStreaming &&
          !entry.streaming,
      );
      // Never re-solve the exact previous ask — even on Ctrl+Enter.
      // Extensions of the same ask are allowed; distinct follow-ups are allowed.
      if (
        !isExtension &&
        (alreadyAnswered ||
          key === lastAudioQuestionRef.current ||
          (prevText != null && isSameSpokenQuestion(trimmed, prevText)))
      ) {
        return false;
      }
      // Auto-pending (force from STT land) still needs a complete ask; manual Ctrl+Enter
      // may answer a slightly short draft the user already heard.
      if (!force && (isTruncatedQuestion(trimmed) || !isSubstantialQuestion(trimmed))) {
        return false;
      }

      const draftId =
        existingEntryId ??
        (isFollowUp
          ? undefined
          : isExtension
            ? answerHistoryRef.current.find(
                (entry) =>
                  isQuestionExtension(entry.question, trimmed) ||
                  normalizeUtterance(entry.question) === normalizeUtterance(prevText || ""),
              )?.id ?? liveDraftIdRef.current
            : liveDraftIdRef.current);

      markVoiceAnswered(trimmed);

      // "what's on this screen?" / "explain the error on this page" — new capture + spoken ask.
      if (refersToOnScreenQuestion(trimmed)) {
        liveDraftIdRef.current = null;
        void (async () => {
          try {
            const imageBase64 = await runActiveScreenshotCapture(
              activeScreenshotRef.current,
              async () => captureScreenshot(),
            );
            if (!imageBase64) throw new Error("Screenshot failed");
            holdScreenshot(imageBase64, "question", { skipCommit: true });
            const interactive = interactiveHandsOnRef.current;
            await runAnalyze(
              interactive
                ? {
                    ...buildInteractiveSolveRequest({
                      questionText: trimmed,
                      attachLatestScreen: true,
                      latestImageBase64: imageBase64,
                      session: taskSessionRef.current,
                      source: "voice",
                    }),
                    interactiveHandsOn: true,
                    existingEntryId: draftId ?? undefined,
                  }
                : { questionText: trimmed, source: "screenshot", imageBase64 },
            );
          } catch (err) {
            setError(err instanceof Error ? err.message : "Screenshot failed");
          }
        })();
        return true;
      }

      const interactive = interactiveHandsOnRef.current;
      if (interactive) {
        void (async () => {
          const { imageBase64: slotShot } = await resolveLatestCommittedScreenshot(
            activeScreenshotRef.current,
          );
          if (slotShot) lastCaptureRef.current = slotShot;
          const latestShot = slotShot ?? lastCaptureRef.current;
          const fuseScreen = shouldFuseVoiceWithScreen({
            hasLatestImage: Boolean(latestShot),
            screenshotPending: screenshotPendingRef.current,
            isFollowUp,
            lastSolveHadScreen: lastSolveHadScreenRef.current,
          });

          if (fuseScreen || isFollowUp) {
            if (taskSessionRef.current) {
              taskSessionRef.current = applyInterviewerQuestionToContext(
                taskSessionRef.current,
                trimmed,
              );
            }
            await runAnalyze({
              ...buildInteractiveSolveRequest({
                questionText: trimmed,
                latestImageBase64: fuseScreen ? latestShot : null,
                attachLatestScreen: fuseScreen,
                session: taskSessionRef.current,
                source: "voice",
              }),
              interactiveHandsOn: true,
              existingEntryId: draftId ?? undefined,
            });
            return;
          }

          // Brand-new spoken question — flush prior task/screenshot thread.
          taskSessionRef.current = initializeInteractiveTaskSession();
          await runAnalyze({
            questionText: trimmed,
            source: "voice",
            existingEntryId: draftId ?? undefined,
          });
        })();
        return true;
      }

      void runAnalyze({
        questionText: trimmed,
        existingEntryId: draftId ?? undefined,
        source: "voice",
      });
      return true;
    },
    [holdScreenshot, markVoiceAnswered, runAnalyze],
  );

  useAudioTranscription({
    enabled: interviewOn,
    paused: audioPaused,
    resetEpoch: audioResetEpoch,
    interruptEpoch: audioInterruptEpoch,
    answeredEpoch: audioAnsweredEpoch,
    answeredText: audioAnsweredText,
    flushEpoch: audioFlushEpoch,
    liveTextRef: liveAudioTextRef,
    prefs,
    onTranscript: handleTranscript,
    onLiveQuestion: upsertLiveQuestion,
    onUtteranceReady,
    onHearing: handleAudioHearing,
    onTranscribing: handleAudioTranscribing,
  });

  useEffect(() => {
    if (!interviewOn) return;
    const timer = setInterval(() => {
      void readAudioStatus()
        .then((status) => {
          const prev = audioRef.current;
          const wasCapturing = prev?.capturing;
          const wasSpeaking = prev?.speaking;
          setAudio(status);
          audioRef.current = status;
          if (status.speaking || (status.bufferedMs ?? 0) > 200) {
            lastAudioActivityAtRef.current = Date.now();
          }
          const current = prefsRef.current;
          if (!current) return;
          if (wasCapturing === status.capturing && wasSpeaking === status.speaking) return;
          void pushOverlay({
            mode: current.mode,
            companyPack: current.companyPack,
            creditBalance: userRef.current?.creditBalance,
            hasScreenshot: Boolean(lastCaptureRef.current),
            ...overlayMeta(),
            audioStatus: status,
          });
        })
        .catch(() => undefined);
    }, 120);
    return () => clearInterval(timer);
  }, [interviewOn, overlayMeta, pushOverlay]);

  const holdScreenshotRef = useRef(holdScreenshot);
  holdScreenshotRef.current = holdScreenshot;

  answerVoiceQuestionRef.current = answerVoiceQuestion;

  const runAnalyzeRef = useRef(runAnalyze);
  const pushOverlayRef = useRef(pushOverlay);
  const overlayMetaRef = useRef(overlayMeta);
  const clearSessionRef = useRef<() => Promise<void>>(async () => undefined);
  runAnalyzeRef.current = runAnalyze;
  pushOverlayRef.current = pushOverlay;
  overlayMetaRef.current = overlayMeta;

  const clearChatDraft = useCallback(() => {
    chatDraftRef.current = "";
    chatDocumentRef.current = null;
    void emit("chat-question-cleared").catch(() => undefined);
  }, []);

  const answerChatQuestion = useCallback(
    (question: string, document?: { name: string; text: string } | null) => {
      const trimmed = question.trim();
      const doc = document ?? chatDocumentRef.current;
      const docText = doc?.text?.trim() || "";
      if ((!trimmed || trimmed.length < 2) && !docText) return false;
      if (!interviewOnRef.current) {
        setError("Click Start to begin the interview first.");
        return false;
      }
      const now = Date.now();
      if (now - lastChatSolveAtRef.current < 500) return true;
      lastChatSolveAtRef.current = now;

      const questionText =
        trimmed ||
        `Based on the attached document${doc?.name ? ` "${doc.name}"` : ""}, give the candidate what they should say or write.`;

      clearChatDraft();
      pendingVoiceSolveRef.current = null;
      const interactive = interactiveHandsOnRef.current;
      if (interactive) {
        void (async () => {
          if (!screenshotPendingRef.current) {
            await refreshInteractiveScreenRef.current("candidate_input");
          }
          const { imageBase64: activeShot } = await resolveLatestCommittedScreenshot(
            activeScreenshotRef.current,
          );
          if (activeShot) lastCaptureRef.current = activeShot;
          if (taskSessionRef.current) {
            let next = applyInterviewerQuestionToContext(
              taskSessionRef.current,
              trimmed || questionText,
            );
            if (trimmed) {
              next = applyCandidateSubmissionToContext(next, trimmed, "text");
            }
            next = appendDocumentNameHint(next, doc?.name);
            taskSessionRef.current = next;
          }
          await runAnalyze({
            questionText,
            interactiveHandsOn: true,
            documentContext: docText || undefined,
            documentName: doc?.name || undefined,
            source: "text",
          });
        })();
        return true;
      }
      void runAnalyze({
        questionText,
        source: "text",
        documentContext: docText || undefined,
        documentName: doc?.name || undefined,
      });
      return true;
    },
    [clearChatDraft, runAnalyze],
  );

  const answerChatQuestionRef = useRef(answerChatQuestion);
  answerChatQuestionRef.current = answerChatQuestion;

  const solveFromHotkey = useCallback(async () => {
    const { imageBase64: activeShot } = await resolveLatestCommittedScreenshot(
      activeScreenshotRef.current,
    );
    if (activeShot) lastCaptureRef.current = activeShot;

    const current = prefsRef.current;
    if (!interviewOnRef.current) {
      const message = "Click Start to begin the interview first.";
      setError(message);
      if (current) {
        void pushOverlayRef.current({
          mode: current.mode,
          companyPack: current.companyPack,
          error: message,
          creditBalance: userRef.current?.creditBalance,
          ...overlayMetaRef.current(),
        });
      }
      return;
    }

    // Pasted / typed chat question (or attached doc) wins over screenshot + voice.
    const chatDraft = chatDraftRef.current.trim();
    const chatDoc = chatDocumentRef.current;
    if (chatDraft || chatDoc?.text?.trim()) {
      if (answerChatQuestionRef.current(chatDraft, chatDoc)) return;
    }
    // Second Ctrl+Enter from the paired global/window hotkey — do not fall through
    // to voice flush / screenshot after we just consumed a chat paste.
    if (Date.now() - lastChatSolveAtRef.current < 500) return;

    const isStaleVoiceQuestion = (text: string, heardAt?: number) => {
      const trimmed = text.trim();
      if (!trimmed) return true;
      // Anything transcribed before the last voice answer is the previous question.
      if (
        typeof heardAt === "number" &&
        heardAt > 0 &&
        lastVoiceAnsweredAtRef.current > 0 &&
        heardAt <= lastVoiceAnsweredAtRef.current
      ) {
        return true;
      }
      // Speech captured before the last screenshot-only solve is leftover.
      // Skip this when a new Ctrl+H is pending — that's audio→screenshot combine.
      if (
        !screenshotPendingRef.current &&
        typeof heardAt === "number" &&
        heardAt > 0 &&
        lastScreenshotSolveAtRef.current > 0 &&
        heardAt <= lastScreenshotSolveAtRef.current
      ) {
        return true;
      }
      const key = normalizeUtterance(trimmed);
      if (key && key === lastAudioQuestionRef.current) return true;
      if (
        lastAudioQuestionTextRef.current &&
        isSameSpokenQuestion(trimmed, lastAudioQuestionTextRef.current)
      ) {
        return true;
      }
      return answerHistoryRef.current.some(
        (entry) =>
          entry.source !== "screenshot" &&
          normalizeUtterance(entry.question) === key &&
          entry.result.solution.trim().length > 0 &&
          !entry.questionStreaming &&
          !entry.streaming,
      );
    };

    const draft = answerHistoryRef.current.find(
      (entry) => entry.questionStreaming && entry.question.trim(),
    );
    const draftText = draft?.question.trim() || "";
    const liveText = liveAudioTextRef.current.trim();

    const heldCombine = heldCombineVoiceRef.current;
    const heldText = heldCombine?.text.trim() || "";
    let questionText = "";
    let questionDraftId: string | undefined;
    if (draftText && !isStaleVoiceQuestion(draftText, draft?.at)) {
      questionText = draftText;
      questionDraftId = draft?.id;
    } else if (liveText && !isStaleVoiceQuestion(liveText)) {
      questionText = liveText;
      questionDraftId = draft?.id ?? liveDraftIdRef.current ?? undefined;
    } else if (heldText && !isStaleVoiceQuestion(heldText, heldCombine?.at)) {
      // Canonical combine: audio was heard first, then Ctrl+H — keep that spoken ask.
      questionText = heldText;
      questionDraftId = draft?.id ?? liveDraftIdRef.current ?? undefined;
    }

    const voiceFresh =
      Boolean(questionText) &&
      !isStaleVoiceQuestion(questionText, draft?.at ?? heldCombine?.at);
    const pendingManualScreen =
      screenshotPendingRef.current && Boolean(activeShot);

    // Combine: spoken question first, screenshot second (either capture order).
    // Screenshot-only only when there is no unanswered audio.
    if (interactiveHandsOnRef.current) {
      if (pendingManualScreen && !voiceFresh && activeShot) {
        pendingVoiceSolveRef.current = null;
        void runAnalyzeRef.current(buildScreenshotOnlySolveRequest(activeShot));
        return;
      }

      const branch = interactiveSolveBranch({
        hasChatDraft: false,
        hasVoiceOrTextQuestion: voiceFresh,
        hasPendingScreenshot: screenshotPendingRef.current,
        hasLatestImage: Boolean(activeShot),
      });
      if (branch === "question" && questionText && voiceFresh) {
        pendingVoiceSolveRef.current = null;
        if (answerVoiceQuestionRef.current(questionText, questionDraftId, true)) return;
      }
      if (branch === "screenshot" && activeShot) {
        const shot = activeShot;
        if (analyzingRef.current && analyzingShotRef.current === shot) {
          pendingVoiceSolveRef.current = null;
          void showOverlay().catch(() => undefined);
          setOverlayOn(true);
          return;
        }
        pendingVoiceSolveRef.current = null;
        void runAnalyzeRef.current(buildScreenshotOnlySolveRequest(shot));
        return;
      }
      if (analyzingRef.current && !analyzingShotRef.current && !questionText) {
        pendingVoiceSolveRef.current = null;
        void showOverlay().catch(() => undefined);
        setOverlayOn(true);
        return;
      }
      pendingVoiceSolveRef.current = Date.now();
      setAudioFlushEpoch((n) => n + 1);
      setError(null);
      if (current) {
        void showOverlay().catch(() => undefined);
        setOverlayOn(true);
        void pushOverlayRef.current({
          mode: current.mode,
          companyPack: current.companyPack,
          error: null,
          creditBalance: userRef.current?.creditBalance,
          hasScreenshot: Boolean(lastCaptureRef.current),
          ...overlayMetaRef.current(),
        });
      }
      return;
    }

    // Screenshot path ONLY when Ctrl+H left a pending capture.
    // Never fall back to an old screenshot during audio Ctrl+Enter — that re-shows
    // the previous answer when the new spoken question was not heard yet.
    // Screenshot path ONLY when Ctrl+H left a pending capture AND there is no
    // fresh spoken question. A new audio ask must win leftover screen bytes.
    if (activeShot && screenshotPendingRef.current && !voiceFresh) {
      const shot = activeShot;
      if (analyzingRef.current && analyzingShotRef.current === shot) {
        pendingVoiceSolveRef.current = null;
        void showOverlay().catch(() => undefined);
        setOverlayOn(true);
        return;
      }
      pendingVoiceSolveRef.current = null;
      void runAnalyzeRef.current(buildScreenshotOnlySolveRequest(shot));
      return;
    }
    if (
      activeShot &&
      analyzingRef.current &&
      analyzingShotRef.current === activeShot
    ) {
      pendingVoiceSolveRef.current = null;
      void showOverlay().catch(() => undefined);
      setOverlayOn(true);
      return;
    }

    // Prefer live draft / in-memory STT only — never fall back to an old transcript
    // (that re-answered Q1 when Ctrl+Enter arrived before Q2 text painted).
    // (questionText already resolved above for Interactive + normal paths.)

    // Voice answer already streaming (user already Ctrl+Enter'd) and no newer ask → focus only.
    if (analyzingRef.current && !analyzingShotRef.current && !questionText) {
      pendingVoiceSolveRef.current = null;
      void showOverlay().catch(() => undefined);
      setOverlayOn(true);
      return;
    }

    // Fresh question text already available (even if overlay hasn't painted) → answer now.
    if (questionText) {
      pendingVoiceSolveRef.current = null;
      if (answerVoiceQuestionRef.current(questionText, questionDraftId, true)) return;
      // Text looked fresh but answer was rejected (exact previous ask) — fall through to flush.
    }

    // No fresh voice question yet — arm auto-answer + force-flush STT for the NEW ask.
    // Keep listening; do NOT show status/warning text in the output window.
    pendingVoiceSolveRef.current = Date.now();
    setAudioFlushEpoch((n) => n + 1);
    setError(null);
    if (current) {
      void showOverlay().catch(() => undefined);
      setOverlayOn(true);
      void pushOverlayRef.current({
        mode: current.mode,
        companyPack: current.companyPack,
        error: null,
        creditBalance: userRef.current?.creditBalance,
        hasScreenshot: Boolean(lastCaptureRef.current),
        ...overlayMetaRef.current(),
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    const unlisteners: Array<() => void> = [];

    void (async () => {
      const attach = async (register: () => Promise<() => void>) => {
        const unlisten = await register();
        if (!active) {
          unlisten();
          return;
        }
        unlisteners.push(unlisten);
      };

      await attach(() => listen("capture-started", () => {
        beginRustCaptureInFlight(activeScreenshotRef.current);
      }));

      await attach(() =>
        listen<{ imageBase64: string }>("capture-ready", (event) => {
          completeRustCaptureInFlight(
            activeScreenshotRef.current,
            event.payload.imageBase64,
          );
          if (!interviewOnRef.current) return;
          // Ctrl+H = capture only. Answer starts on Ctrl+Enter (solve-requested).
          holdScreenshotRef.current(event.payload.imageBase64, "manual", {
            skipCommit: true,
          });
          const current = prefsRef.current;
          if (!current) return;
          void showOverlay().catch(() => undefined);
          setOverlayOn(true);
          void pushOverlayRef.current({
            mode: current.mode,
            companyPack: current.companyPack,
            hasScreenshot: true,
            focusResponse: true,
            creditBalance: userRef.current?.creditBalance,
            ...overlayMetaRef.current(),
          });
        }),
      );

      await attach(() =>
        listen("solve-requested", () => {
          void (async () => {
            await flushActiveScreenshotCaptures(activeScreenshotRef.current);
            await solveFromHotkey();
          })();
        }),
      );

      await attach(() =>
        listen<{ error: string }>("capture-error", (event) => {
          abortRustCaptureInFlight(activeScreenshotRef.current);
          setError(event.payload.error);
        }),
      );

      await attach(() =>
        listen<{ error: string }>("interview-required", (event) => {
          setError(event.payload.error);
        }),
      );

      await attach(() =>
        listen("start-over", () => {
          void clearSessionRef.current();
        }),
      );

      await attach(() =>
        listen<{
          text?: string;
          document?: { name?: string; text?: string } | null;
        }>("chat-question-draft", (event) => {
          chatDraftRef.current = (event.payload.text ?? "").toString();
          const doc = event.payload.document;
          const name = doc?.name?.trim() || "";
          const text = doc?.text?.trim() || "";
          chatDocumentRef.current = name && text ? { name, text } : null;
        }),
      );

      await attach(() =>
        listen<{
          text?: string;
          document?: { name?: string; text?: string } | null;
        }>("chat-question-submit", (event) => {
          const text = (event.payload.text ?? chatDraftRef.current).toString();
          const docPayload = event.payload.document;
          const document =
            docPayload?.name?.trim() && docPayload?.text?.trim()
              ? { name: docPayload.name.trim(), text: docPayload.text.trim() }
              : chatDocumentRef.current;
          answerChatQuestionRef.current(text, document);
        }),
      );
    })();

    return () => {
      active = false;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [solveFromHotkey]);

  useEffect(() => {
    (async () => {
      try {
        // Webview remount / HMR can leave Rust interview_active=true while Start is showing.
        // Do this before prefs so Start cannot win a race and then get cleared.
        await setInterviewActive(false).catch(() => undefined);
        const loaded = await loadPrefs();
        // Persist resolved URL (www / prod) so older localhost/apex prefs don't stick.
        const persisted =
          import.meta.env.PROD ? await savePrefs(loaded).catch(() => loaded) : loaded;
        setPrefs(persisted);
        prefsRef.current = persisted;
        // Token alone decides login UI — no /api/user or resume fetch at boot.
        // Those run on Start Interview so restored sessions stay offline until then.
        if (!persisted.token) {
          setNeedsLogin(true);
          setUser({ ...DEMO_USER });
        } else {
          setNeedsLogin(false);
          setUser({ ...DEMO_USER });
        }
        setAudio(await readAudioStatus());
        setBoot("");
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Could not start.";
        setBoot(message);
      }
    })();
  }, []);

  const startInterview = useCallback(async () => {
    if (!prefs || interviewStarting || interviewOnRef.current) return;

    setInterviewStarting(true);
    setError(null);

    try {
      // Refresh access + resume only when the interview actually starts.
      const session = await ensureDesktopSession(prefs);
      setPrefs(session.prefs);
      prefsRef.current = session.prefs;
      if (session.prefs.token !== prefs.token) {
        await savePrefs(session.prefs).catch(() => undefined);
      }
      if (session.needsLogin || !session.user) {
        setUser({ ...DEMO_USER });
        setNeedsLogin(true);
        return;
      }
      setUser(session.user);
      userRef.current = session.user;
      const readyPrefs = await syncResumeFromCloud(session.prefs);

      try {
        await setInterviewActive(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start interview.");
        return;
      }

      // Keep sessionId across Stop→Start (same interview). New id only after logout/quit.
      if (!interviewSessionIdRef.current) {
        interviewSessionIdRef.current = newSessionId();
        interviewSessionStartedAtRef.current = new Date().toISOString();
      }
      setInterviewOn(true);
      interviewOnRef.current = true;
      clearInteractiveState();
      answerHistoryRef.current = [];
      setLastResult(null);
      lastResultRef.current = null;
      enableUnifiedInterviewSession();
      setTranscripts([]);
      transcriptsRef.current = [];
      lastAudioQuestionRef.current = null;
      lastAudioQuestionTextRef.current = null;
      lastVoiceAnsweredAtRef.current = 0;
      lastScreenshotSolveAtRef.current = 0;
      lastSolveHadScreenRef.current = false;
      heldCombineVoiceRef.current = null;
      liveDraftIdRef.current = null;
      liveAudioTextRef.current = "";
      pendingVoiceSolveRef.current = null;
      chatDraftRef.current = "";
      chatDocumentRef.current = null;
      bumpAudioReset();
      setError(null);

      // Start listening before opening the overlay so capture is ready when UI appears.
      setAudioPaused(false);
      audioPausedRef.current = false;
      audioHearingRef.current = false;
      setAudioHearing(false);
      audioTranscribingRef.current = false;
      setAudioTranscribing(false);
      const audioStatus = await startSystemAudio().catch(() => null);
      if (audioStatus) {
        setAudio(audioStatus);
        audioRef.current = audioStatus;
      }
      if (!audioStatus?.capturing) {
        setError(
          audioStatus?.error ??
            "Could not start audio capture. Play meeting audio through Zoom/Teams/Chrome or your speakers.",
        );
      }

      await showOverlay().catch(() => undefined);
      setOverlayOn(true);
      await pushOverlay({
        ...overlayMeta(),
        mode: readyPrefs.mode,
        companyPack: readyPrefs.companyPack,
        creditBalance: userRef.current?.creditBalance,
        hasScreenshot: false,
        screenshotPending: false,
        listening: Boolean(audioStatus?.capturing),
        audioHearing: false,
        transcripts: [],
        audioStatus: audioStatus ?? audioRef.current,
        error: audioStatus?.capturing
          ? null
          : audioStatus?.error ??
            "Could not start audio capture. Play meeting audio through Zoom/Teams/Chrome or your speakers.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start interview.");
    } finally {
      setInterviewStarting(false);
    }
  }, [
    bumpAudioReset,
    interviewStarting,
    overlayMeta,
    prefs,
    pushOverlay,
    syncResumeFromCloud,
    clearInteractiveState,
    enableUnifiedInterviewSession,
  ]);

  const stopSystemAudioCapture = useCallback(async () => {
    void discardAudioChunk(0).catch(() => undefined);
    try {
      const status = await stopSystemAudio();
      setAudio(status);
      audioRef.current = status;
      return status;
    } catch {
      const idle: AudioStatus = {
        available: false,
        capturing: false,
        speaking: false,
        backend: "",
        frames: 0,
        note: "",
        error: null,
      };
      setAudio(idle);
      audioRef.current = idle;
      return idle;
    }
  }, []);

  const pauseAudioListening = useCallback(async () => {
    if (!interviewOnRef.current) return;
    setAudioPaused(true);
    audioPausedRef.current = true;
    audioHearingRef.current = false;
    setAudioHearing(false);
    audioTranscribingRef.current = false;
    setAudioTranscribing(false);
    await stopSystemAudioCapture();
    const current = prefsRef.current;
    if (current) {
      await pushOverlay({
        mode: current.mode,
        companyPack: current.companyPack,
        creditBalance: userRef.current?.creditBalance,
        ...overlayMeta(),
        listening: false,
        audioHearing: false,
        audioTranscribing: false,
        audioStatus: audioRef.current,
      });
    }
  }, [overlayMeta, pushOverlay, stopSystemAudioCapture]);

  const resumeAudioListening = useCallback(async () => {
    if (!interviewOnRef.current) return;
    if (audioPauseTimerRef.current) {
      clearTimeout(audioPauseTimerRef.current);
      audioPauseTimerRef.current = null;
    }
    setAudioPaused(false);
    audioPausedRef.current = false;
    setError(null);
    const audioStatus = await startSystemAudio().catch(() => null);
    if (audioStatus) {
      setAudio(audioStatus);
      audioRef.current = audioStatus;
    }
    if (!audioStatus?.capturing) {
      setError(
        audioStatus?.error ??
          "Could not start audio capture. Play meeting audio through Zoom/Teams/Chrome or your speakers.",
      );
    }
    const current = prefsRef.current;
    if (current) {
      await pushOverlay({
        mode: current.mode,
        companyPack: current.companyPack,
        creditBalance: userRef.current?.creditBalance,
        ...overlayMeta(),
        listening: true,
        audioStatus: audioStatus ?? audioRef.current,
      });
    }
  }, [overlayMeta, pushOverlay]);

  /** Play/pause toggle for system-audio listening (independent of Start/Done). */
  const toggleAudioListening = useCallback(async () => {
    if (!interviewOnRef.current) return;
    if (audioPausedRef.current) {
      await resumeAudioListening();
    } else {
      await pauseAudioListening();
    }
  }, [pauseAudioListening, resumeAudioListening]);

  const stopInterview = useCallback(async () => {
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;
    analyzingRef.current = false;
    setAnalyzing(false);
    setInterviewOn(false);
    interviewOnRef.current = false;
    clearInteractiveState();
    setAudioPaused(false);
    audioPausedRef.current = false;
    if (audioPauseTimerRef.current) {
      clearTimeout(audioPauseTimerRef.current);
      audioPauseTimerRef.current = null;
    }
    audioHearingRef.current = false;
    setAudioHearing(false);
    audioTranscribingRef.current = false;
    setAudioTranscribing(false);
    setError(null);
    bumpAudioReset();
    await setInterviewActive(false).catch(() => undefined);
    await stopSystemAudioCapture();
    const current = prefsRef.current;
    if (current) {
      await pushOverlay({
        mode: current.mode,
        companyPack: current.companyPack,
        creditBalance: userRef.current?.creditBalance,
        ...overlayMeta(),
        listening: false,
        audioHearing: false,
        audioTranscribing: false,
        audioStatus: audioRef.current,
        error: null,
        analyzing: false,
        streaming: false,
      });
    }
    await hideOverlay().catch(() => undefined);
    setOverlayOn(false);
  }, [bumpAudioReset, clearInteractiveState, overlayMeta, pushOverlay, stopSystemAudioCapture]);

  const takeScreenshot = useCallback(async () => {
    if (!requireInterview("taking a screenshot")) return;
    setError(null);
    // Capture only — overwrites the single held image; do not touch audio / live drafts.
    try {
      const imageBase64 = await runActiveScreenshotCapture(
        activeScreenshotRef.current,
        async () => captureScreenshot(),
      );
      if (!imageBase64) throw new Error("Screenshot failed");
      holdScreenshot(imageBase64, "manual", { skipCommit: true });
      await showOverlay().catch(() => undefined);
      setOverlayOn(true);
      const current = prefsRef.current;
      if (current) {
        await pushOverlay({
          mode: current.mode,
          companyPack: current.companyPack,
          hasScreenshot: true,
          focusResponse: true,
          creditBalance: userRef.current?.creditBalance,
          ...overlayMeta(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screenshot failed");
    }
  }, [holdScreenshot, overlayMeta, pushOverlay, requireInterview]);

  const solve = useCallback(async () => {
    if (!requireInterview("answering")) return;
    await requestSolve().catch(() => undefined);
  }, [requireInterview]);

  const toggleOverlay = useCallback(async () => {
    await toggleAppVisibility();
  }, []);

  /** Drop held screenshot bytes; keep Interactive TaskSession when Live stays on. */
  const clearActiveScreenshotSlot = useCallback(() => {
    invalidateActiveScreenshotSession(activeScreenshotRef.current);
    lastCaptureRef.current = null;
    screenshotPendingRef.current = false;
    analyzingShotRef.current = null;
    lastSolveHadScreenRef.current = false;
    void clearStoredCapture().catch(() => undefined);
  }, []);

  /** Ctrl+G — wipe screenshots, live questions, answers, and in-flight solves. */
  const clearSession = useCallback(async () => {
    const interviewActive = interviewOnRef.current;

    // Invalidate in-flight analyze so a late screenshot/audio result cannot restore Q&A.
    analyzeGenerationRef.current += 1;
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;
    analyzingRef.current = false;
    analyzingShotRef.current = null;
    setAnalyzing(false);

    clearActiveScreenshotSlot();
    if (!interviewActive) {
      clearInteractiveState();
    } else if (interactiveHandsOnRef.current) {
      // Keep Interactive on, but drop the old task/question thread.
      taskSessionRef.current = initializeInteractiveTaskSession();
    }

    lastAudioQuestionRef.current = null;
    lastAudioQuestionTextRef.current = null;
    lastVoiceAnsweredAtRef.current = 0;
    lastScreenshotSolveAtRef.current = 0;
    lastSolveHadScreenRef.current = false;
    heldCombineVoiceRef.current = null;
    liveDraftIdRef.current = null;
    pendingVoiceSolveRef.current = null;
    liveAudioTextRef.current = "";
    chatDraftRef.current = "";
    chatDocumentRef.current = null;
    answerHistoryRef.current = [];
    setLastResult(null);
    lastResultRef.current = null;
    setTranscripts([]);
    transcriptsRef.current = [];
    setError(null);
    bumpAudioReset();
    void discardAudioChunk(0).catch(() => undefined);
    void emit("chat-question-cleared").catch(() => undefined);

    const current = prefsRef.current;
    if (current) {
      await pushOverlay({
        mode: current.mode,
        companyPack: current.companyPack,
        hasScreenshot: false,
        screenshotPending: false,
        result: null,
        answerHistory: [],
        transcripts: [],
        listening: interviewOnRef.current && !audioPausedRef.current,
        audioHearing: audioHearingRef.current,
        audioStatus: audioRef.current,
        error: null,
        analyzing: false,
        streaming: false,
        creditBalance: userRef.current?.creditBalance,
        interactiveHandsOn: interviewActive && interactiveHandsOnRef.current,
      });
    }
  }, [bumpAudioReset, clearActiveScreenshotSlot, clearInteractiveState, pushOverlay]);

  clearSessionRef.current = clearSession;

  const completeLogin = useCallback(
    (next: { prefs: Prefs; user: UserProfile }) => {
      setPrefs(next.prefs);
      prefsRef.current = next.prefs;
      // Login API payload only — /api/user + resume sync wait for Start Interview.
      setUser(next.user);
      userRef.current = next.user;
      setNeedsLogin(false);
      setBoot("");
      // New sign-in must not reuse a prior user's held screenshot or response stack.
      clearActiveScreenshotSlot();
      answerHistoryRef.current = [];
      setLastResult(null);
      lastResultRef.current = null;
      interviewSessionIdRef.current = null;
      interviewSessionStartedAtRef.current = null;
      // Overlay mounts before login and caches a revoked token — refresh it.
      void emit("prefs-updated", { overlayOpacity: next.prefs.overlayOpacity }).catch(
        () => undefined,
      );
    },
    [clearActiveScreenshotSlot],
  );

  const syncLocalQuestionsToDb = useCallback(async () => {
    const current = prefsRef.current;
    if (!current?.token) return;

    const partialDays = await listUnsyncedInterviewEntries(30).catch(() => []);
    const dates = unsyncedDates(partialDays);
    if (!dates.length) return;

    const payload: Array<{ date: string; question: string }> = [];
    for (const date of dates) {
      const fullDay = await loadInterviewDay(date).catch(() => null);
      if (!fullDay?.sessions?.length) continue;
      // Local heuristic clean before POST — fewer junk rows, no GPT.
      const cleaned = cleanInterviewDayForSync(fullDay);
      if (!cleaned.sessions.length) continue;
      payload.push({
        date,
        question: JSON.stringify(cleaned),
      });
    }
    if (!payload.length) return;

    const result = await syncInterviewDays(current, payload).catch((err) => {
      console.error("[interview-history] day sync failed", err);
      return null;
    });
    if (!result?.dates?.length && !(result && result.saved > 0)) return;

    const saved = new Set(result.dates.length ? result.dates : dates);
    for (const date of dates) {
      if (!saved.has(date)) continue;
      await markInterviewDaySynced(date).catch(() => undefined);
    }
  }, []);

  const logout = useCallback(async () => {
    if (interviewOnRef.current) {
      await stopInterview().catch(() => undefined);
    }
    await syncLocalQuestionsToDb().catch(() => undefined);
    interviewSessionIdRef.current = null;
    interviewSessionStartedAtRef.current = null;
    await clearSession().catch(() => undefined);
    await hideOverlay().catch(() => undefined);
    setOverlayOn(false);

    const current = prefsRef.current;
    if (!current) {
      setUser({ ...DEMO_USER });
      setNeedsLogin(true);
      return;
    }

    // Keep Remember-me credentials across logout (token only is cleared).
    const disk = await loadPrefs().catch(() => null);
    const rememberMe = Boolean(current.rememberMe || disk?.rememberMe);
    const rememberedEmail = rememberMe
      ? current.rememberedEmail || disk?.rememberedEmail || ""
      : "";
    const rememberedPassword = rememberMe
      ? current.rememberedPassword || disk?.rememberedPassword || ""
      : "";

    const cleared = await savePrefs({
      ...current,
      token: null,
      rememberMe,
      rememberedEmail,
      rememberedPassword,
    });
    prefsRef.current = cleared;
    setPrefs(cleared);
    setUser({ ...DEMO_USER });
    setNeedsLogin(true);
    setError(null);
    setBoot("");
  }, [clearSession, stopInterview, syncLocalQuestionsToDb]);

  const quitWithSync = useCallback(async () => {
    if (interviewOnRef.current) {
      await stopInterview().catch(() => undefined);
    }
    await syncLocalQuestionsToDb().catch((err) => {
      console.error("[interview-history] sync on quit failed", err);
    });
    interviewSessionIdRef.current = null;
    interviewSessionStartedAtRef.current = null;
    // Do not await — exit tears down the webview; awaiting can hang the UI.
    void quitApp().catch((err) => {
      console.error("[quit] quit_app failed", err);
    });
  }, [stopInterview, syncLocalQuestionsToDb]);

  return {
    prefs,
    setPrefs,
    user,
    needsLogin,
    completeLogin,
    logout,
    quitWithSync,
    analyzing,
    error,
    overlayOn,
    interviewOn,
    interviewStarting,
    lastResult,
    audio,
    audioHearing,
    audioTranscribing,
    audioPaused,
    transcripts,
    boot,
    persist,
    startInterview,
    stopInterview,
    toggleAudioListening,
    takeScreenshot,
    solve,
    toggleOverlay,
    clearSession,
    runAnalyze,
  };
}
