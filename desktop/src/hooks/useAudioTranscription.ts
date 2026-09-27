import { useEffect, useRef } from "react";
import { transcribeAudio } from "../lib/api";
import {
  isFollowUpQuestion,
  isNoiseTranscription,
  isQuestionExtension,
  isSameSpokenQuestion,
  isUtteranceContinuation,
  isWhisperHallucination,
  mergeUtterance,
  normalizeUtterance,
} from "../lib/interviewSpeech";
import { discardAudioChunk, forceTakeAudioChunk, peekAudioChunk, peekProgressAudioChunk, takeAudioChunk } from "../lib/tauri";
import type { Prefs, TranscriptEntry } from "../lib/types";

const POLL_MS = 40;
const MIN_SPEECH_MS = 280;
/** Start STT while interviewer is still talking (no silence wait). */
const EARLY_PEEK_MIN_MS = 800;
/** Re-run peek STT when buffered speech grows by this much. */
const PEEK_REFRESH_GROWTH_MS = 1400;
/**
 * STT of a long clip often takes 2–10s while the next fragment is already buffered.
 * Measuring from speech-take time (not STT return) + a wide window keeps merges alive.
 */
const CONTINUE_WINDOW_MS = 14_000;
/** Reuse peek STT when take is only a bit longer (silence padding). */
const SPECULATIVE_DURATION_SLACK_MS = 600;

/** Soft gate for live Q preview — show almost anything that isn't filler/hallucination. */
function canShowAsLiveQuestion(text: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (isWhisperHallucination(trimmed)) return false;
  // Exact one-word filler ("okay", "hmm") — skip. Partials like "What does" still show.
  if (/^(you|thank you|thanks|okay|ok|hmm+|uh+|um+|bye|hi|hey|hup)[\s.!?,]*$/i.test(trimmed)) {
    return false;
  }
  return true;
}

type Options = {
  enabled: boolean;
  paused?: boolean;
  /** Increment to clear dedupe state (Start Over / clear session). */
  resetEpoch?: number;
  /** Increment to drop in-flight STT without forgetting the last answered question. */
  interruptEpoch?: number;
  /**
   * After Ctrl+Enter answers a voice draft — mark that text as answered so live
   * STT does not reopen the same question as a new draft.
   */
  answeredEpoch?: number;
  answeredText?: string | null;
  /**
   * Bump when user presses Ctrl+Enter before STT text is ready — force-take
   * buffered speech and start transcription immediately (skip silence wait).
   */
  flushEpoch?: number;
  /**
   * Mirrors the current accumulated STT sentence so Ctrl+Enter can answer
   * before the overlay finishes painting the question text.
   */
  liveTextRef?: { current: string };
  prefs: Prefs | null;
  onTranscript: (entry: TranscriptEntry) => void;
  onLiveQuestion: (question: string) => void;
  /** Fired whenever accumulated interviewer speech text changes (for early Ctrl+Enter). */
  onUtteranceReady?: (question: string) => void;
  onHearing?: (hearing: boolean) => void;
  /** Fired while STT is in-flight (peek/take/flush) so UI can show Processing… */
  onTranscribing?: (busy: boolean) => void;
};

type Speculative = {
  id: number;
  durationMs: number;
  promise: Promise<string>;
  text: string;
  done: boolean;
};

export function useAudioTranscription({
  enabled,
  paused = false,
  resetEpoch = 0,
  interruptEpoch = 0,
  answeredEpoch = 0,
  answeredText = null,
  flushEpoch = 0,
  liveTextRef,
  prefs,
  onTranscript,
  onLiveQuestion,
  onUtteranceReady,
  onHearing,
  onTranscribing,
}: Options) {
  const busyRef = useRef(false);
  const lastQuestionRef = useRef<string | null>(null);
  const lastQuestionTextRef = useRef<string | null>(null);
  const sentenceRef = useRef("");
  const lastChunkAtRef = useRef(0);
  const speculativeRef = useRef<Speculative | null>(null);
  const specIdRef = useRef(0);
  const sessionGenRef = useRef(0);
  const pendingFlushRef = useRef(false);
  const lastFlushEpochRef = useRef(0);
  const runFlushRef = useRef<(() => Promise<void>) | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  const onLiveQuestionRef = useRef(onLiveQuestion);
  const onUtteranceReadyRef = useRef(onUtteranceReady);
  const onHearingRef = useRef(onHearing);
  const onTranscribingRef = useRef(onTranscribing);
  const prefsRef = useRef(prefs);
  const liveTextRefInternal = useRef(liveTextRef);
  onTranscriptRef.current = onTranscript;
  onLiveQuestionRef.current = onLiveQuestion;
  onUtteranceReadyRef.current = onUtteranceReady;
  onHearingRef.current = onHearing;
  onTranscribingRef.current = onTranscribing;
  prefsRef.current = prefs;
  liveTextRefInternal.current = liveTextRef;

  useEffect(() => {
    // Start Over / new interview — forget answered-question dedupe.
    lastQuestionRef.current = null;
    lastQuestionTextRef.current = null;
    sentenceRef.current = "";
    lastChunkAtRef.current = 0;
    speculativeRef.current = null;
  }, [resetEpoch]);

  useEffect(() => {
    if (interruptEpoch === 0) return;
    // Drop the current utterance only — poll loop restarts via interruptEpoch dep below.
    sentenceRef.current = "";
    lastChunkAtRef.current = 0;
    speculativeRef.current = null;
    void discardAudioChunk(0).catch(() => undefined);
  }, [interruptEpoch]);

  useEffect(() => {
    if (answeredEpoch === 0) return;
    const trimmed = answeredText?.trim();
    if (!trimmed) return;
    lastQuestionRef.current = normalizeUtterance(trimmed);
    lastQuestionTextRef.current = trimmed;
    sentenceRef.current = "";
    lastChunkAtRef.current = 0;
    speculativeRef.current = null;
    if (liveTextRefInternal.current) liveTextRefInternal.current.current = "";
    // Clear buffered speech from the answered ask so the next question starts clean.
    void discardAudioChunk(0).catch(() => undefined);
  }, [answeredEpoch, answeredText]);

  useEffect(() => {
    if (flushEpoch === 0 || flushEpoch === lastFlushEpochRef.current) return;
    lastFlushEpochRef.current = flushEpoch;
    pendingFlushRef.current = true;
    // Run immediately — don't wait up to POLL_MS for the next interval tick.
    void runFlushRef.current?.();
  }, [flushEpoch]);

  useEffect(() => {
    if (!enabled || paused || !prefs) {
      sessionGenRef.current += 1;
      speculativeRef.current = null;
      runFlushRef.current = null;
      busyRef.current = false;
      onHearingRef.current?.(false);
      onTranscribingRef.current?.(false);
      return;
    }

    const myGen = ++sessionGenRef.current;
    const stillActive = () => myGen === sessionGenRef.current;
    let transcribing = false;
    const reportTranscribing = (busy: boolean) => {
      if (transcribing === busy) return;
      transcribing = busy;
      onTranscribingRef.current?.(busy);
    };

    const publishUtterance = (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      if (liveTextRefInternal.current) liveTextRefInternal.current.current = trimmed;
      onUtteranceReadyRef.current?.(trimmed);
      if (!canShowAsLiveQuestion(trimmed)) return;
      if (normalizeUtterance(trimmed) === lastQuestionRef.current) return;
      onLiveQuestionRef.current(trimmed);
    };

    /**
     * Merge every usable STT fragment into the live question draft.
     * Peek + take both go through here so the Q section always shows what audio said so far.
     */
    const ingestSpeech = (text: string, speechAt = Date.now()) => {
      if (!stillActive()) return;
      const trimmed = text.trim();
      if (!trimmed || isWhisperHallucination(trimmed)) return;

      // Soft gate for first paint — allow 2+ word partials onto the Q section ASAP.
      // Old 3-word noise filter hid early streaming STT tokens for seconds.
      const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
      if (
        !sentenceRef.current &&
        !trimmed.includes("?") &&
        wordCount < 2 &&
        (isNoiseTranscription(trimmed) || trimmed.length < 8)
      ) {
        return;
      }

      const recent = speechAt - lastChunkAtRef.current < CONTINUE_WINDOW_MS;
      const prevSentence = sentenceRef.current;
      const lastAnswered = lastQuestionTextRef.current || "";
      const extendsLastAnswer =
        Boolean(lastAnswered) && isQuestionExtension(lastAnswered, trimmed);
      const followUpToLast =
        Boolean(lastAnswered) && isFollowUpQuestion(trimmed, lastAnswered);
      // Exact / near-exact text we already answered — ignore unless it's a longer
      // extension or an explicit follow-up. Stops leftover PCM from reopening Q1.
      // Use strict same-ask matching (not bag-of-words) so a new question is never dropped.
      if (
        lastAnswered &&
        !extendsLastAnswer &&
        !followUpToLast &&
        (normalizeUtterance(trimmed) === lastQuestionRef.current ||
          isSameSpokenQuestion(trimmed, lastAnswered))
      ) {
        return;
      }

      // Same as current draft — refresh + notify (early Ctrl+Enter may be waiting).
      if (prevSentence && normalizeUtterance(trimmed) === normalizeUtterance(prevSentence)) {
        lastChunkAtRef.current = speechAt;
        publishUtterance(prevSentence);
        return;
      }

      // Prefer the longer form when a later STT extends the same ask
      // ("What are args?" → "What are args and kwargs?").
      if (
        prevSentence &&
        recent &&
        isQuestionExtension(prevSentence, trimmed)
      ) {
        sentenceRef.current = trimmed;
        lastChunkAtRef.current = speechAt;
        publishUtterance(sentenceRef.current);
        onTranscriptRef.current({
          text: sentenceRef.current,
          at: Date.now(),
          role: "interviewer",
        });
        return;
      }

      const shouldMerge =
        Boolean(prevSentence) &&
        recent &&
        (isUtteranceContinuation(prevSentence, trimmed) ||
          isQuestionExtension(prevSentence, trimmed) ||
          // Prefer growing the same ask over replacing with a shorter peek fragment.
          normalizeUtterance(trimmed).startsWith(
            normalizeUtterance(prevSentence).replace(/[?.!,;:]+$/g, "").slice(0, 24),
          ));

      // Don't shrink the live draft with a shorter peek of the same question.
      if (
        prevSentence &&
        recent &&
        trimmed.length + 8 < prevSentence.length &&
        normalizeUtterance(prevSentence).includes(normalizeUtterance(trimmed).slice(0, 20))
      ) {
        publishUtterance(prevSentence);
        return;
      }

      // After an answered question, a clearly new ask must replace — not merge into Q1.
      const startsFreshAfterAnswer =
        Boolean(lastAnswered) &&
        !prevSentence &&
        !extendsLastAnswer &&
        !followUpToLast;

      sentenceRef.current =
        shouldMerge && !startsFreshAfterAnswer
          ? mergeUtterance(prevSentence, trimmed)
          : trimmed;
      lastChunkAtRef.current = speechAt;

      publishUtterance(sentenceRef.current);
      onTranscriptRef.current({
        text: sentenceRef.current,
        at: Date.now(),
        role: "interviewer",
      });
    };

    let hearing = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const reportHearing = (next: boolean) => {
      if (next) {
        if (idleTimer) {
          clearTimeout(idleTimer);
          idleTimer = null;
        }
        if (hearing) return;
        hearing = true;
        onHearingRef.current?.(true);
        return;
      }
      if (!hearing || idleTimer) return;
      idleTimer = setTimeout(() => {
        idleTimer = null;
        hearing = false;
        onHearingRef.current?.(false);
      }, 80);
    };

    const transcribeText = async (
      audioBase64: string,
      onPartial?: (text: string) => void,
    ) => {
      const currentPrefs = prefsRef.current;
      if (!currentPrefs) return "";
      const t0 = performance.now();
      const { text } = await transcribeAudio(
        currentPrefs,
        audioBase64,
        undefined,
        onPartial,
      );
      if (import.meta.env.DEV) {
        console.debug(`[audio] STT ${Math.round(performance.now() - t0)}ms →`, text.slice(0, 80));
      }
      return text.trim();
    };

    const acceptPeekText = (id: number, text: string) => {
      const spec = speculativeRef.current;
      if (!spec || spec.id !== id) return;
      spec.done = true;
      spec.text = text;
      if (!stillActive()) return;
      if (!text || isWhisperHallucination(text)) return;
      // Always put peek text into the Question section — user answers with Ctrl+Enter.
      ingestSpeech(text);
    };

    const startSpeculative = (audioBase64: string, durationMs: number) => {
      const id = ++specIdRef.current;
      const slot: Speculative = {
        id,
        durationMs,
        text: "",
        done: false,
        promise: Promise.resolve(""),
      };
      reportTranscribing(true);
      slot.promise = transcribeText(audioBase64, (partial) => {
        const spec = speculativeRef.current;
        if (!spec || spec.id !== id || !stillActive()) return;
        spec.text = partial;
        if (!partial || isWhisperHallucination(partial)) return;
        // Stream partials to the Q section ASAP (don't wait for final STT).
        ingestSpeech(partial);
      })
        .then((text) => {
          acceptPeekText(id, text);
          return text;
        })
        .catch((err) => {
          if (import.meta.env.DEV) console.warn("[audio] peek transcribe failed:", err);
          if (speculativeRef.current?.id === id) speculativeRef.current = null;
          return "";
        })
        .finally(() => {
          // Clear only if this peek still owns the slot and take/flush isn't busy.
          if (busyRef.current) return;
          if (speculativeRef.current?.id === id) {
            reportTranscribing(false);
          } else if (!speculativeRef.current) {
            reportTranscribing(false);
          }
        });
      speculativeRef.current = slot;
    };

    const resolveTranscript = async (
      chunk: { audioBase64: string; durationMs: number },
      spec: Speculative | null,
    ) => {
      if (!spec) {
        return transcribeText(chunk.audioBase64);
      }

      const peekText = spec.done ? spec.text : await spec.promise;
      const longerBy = chunk.durationMs - spec.durationMs;

      // Prefer peek when take barely grew (mostly silence pad) and peek has real text.
      if (peekText && longerBy <= SPECULATIVE_DURATION_SLACK_MS) {
        return peekText;
      }

      if (longerBy > SPECULATIVE_DURATION_SLACK_MS || !peekText) {
        if (import.meta.env.DEV) {
          console.debug(`[audio] peek stale (+${longerBy}ms) — fresh STT only`);
        }
        return transcribeText(chunk.audioBase64);
      }

      return peekText || transcribeText(chunk.audioBase64);
    };

    const runFlush = async () => {
      if (!stillActive() || !pendingFlushRef.current || busyRef.current) return;
      pendingFlushRef.current = false;
      busyRef.current = true;
      reportTranscribing(true);
      const speechAt = Date.now();
      try {
        const spec = speculativeRef.current;
        // Ctrl+Enter: take buffered speech now (no silence wait), then STT.
        // Prefer peek only when take barely grew — never discard a longer clip.
        const chunk = await forceTakeAudioChunk(MIN_SPEECH_MS);
        if (!stillActive()) return;

        if (chunk?.audioBase64) {
          reportHearing(true);
          speculativeRef.current = null;
          const text = await resolveTranscript(chunk, spec);
          if (!stillActive() || !text) return;
          ingestSpeech(text, speechAt);
          return;
        }

        // Buffer still below min — reuse peek so Ctrl+Enter isn't a no-op.
        if (spec?.done && spec.text.trim()) {
          speculativeRef.current = null;
          ingestSpeech(spec.text, speechAt);
          return;
        }
        if (spec && !spec.done) {
          const peekText = await spec.promise;
          if (!stillActive()) return;
          speculativeRef.current = null;
          if (peekText.trim()) ingestSpeech(peekText, speechAt);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[audio] flush transcribe failed:", err);
      } finally {
        busyRef.current = false;
        reportTranscribing(false);
        reportHearing(false);
      }
    };
    runFlushRef.current = () => runFlush();

    const tick = async () => {
      const currentPrefs = prefsRef.current;
      if (!stillActive() || busyRef.current || !currentPrefs) return;

      // Ctrl+Enter before text: skip silence wait, STT whatever speech is buffered.
      if (pendingFlushRef.current) {
        await runFlush();
        return;
      }

      const chunk = await takeAudioChunk(MIN_SPEECH_MS);
      if (!stillActive()) return;
      if (chunk?.audioBase64) {
        reportHearing(true);
        busyRef.current = true;
        reportTranscribing(true);
        // Stamp before STT — continue-window must survive slow Whisper on long clips.
        const speechAt = Date.now();
        try {
          const spec = speculativeRef.current;
          speculativeRef.current = null;
          const text = await resolveTranscript(chunk, spec);
          if (!stillActive() || !text) return;
          ingestSpeech(text, speechAt);
        } catch (err) {
          if (import.meta.env.DEV) console.warn("[audio] transcription tick failed:", err);
        } finally {
          busyRef.current = false;
          reportTranscribing(false);
          reportHearing(false);
          // Early Ctrl+Enter may have armed flush while we were busy — run it now.
          if (pendingFlushRef.current) void runFlush();
        }
        return;
      }

      const spec = speculativeRef.current;
      // In-flight peek — don't stack another STT; take/flush will reuse it.
      if (spec && !spec.done) {
        reportTranscribing(true);
        reportHearing(true);
        return;
      }

      // Prefer near-end silence peek; else mid-speech progress peek for early Q text.
      const silencePeek = await peekAudioChunk(MIN_SPEECH_MS);
      const progressPeek =
        silencePeek?.audioBase64
          ? null
          : await peekProgressAudioChunk(EARLY_PEEK_MIN_MS);
      const peek = silencePeek?.audioBase64 ? silencePeek : progressPeek;
      if (!stillActive()) return;
      if (!peek?.audioBase64) {
        if (spec?.done && spec.text) {
          if (!busyRef.current) reportTranscribing(false);
          reportHearing(false);
          return;
        }
        if (!busyRef.current) reportTranscribing(false);
        reportHearing(false);
        return;
      }

      reportHearing(true);
      // Refresh speculative when speech grew — old peek used to freeze Q text until silence.
      if (!spec || peek.durationMs > spec.durationMs + PEEK_REFRESH_GROWTH_MS) {
        startSpeculative(peek.audioBase64, peek.durationMs);
      } else if (!busyRef.current && spec.done) {
        reportTranscribing(false);
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), POLL_MS);
    return () => {
      sessionGenRef.current += 1;
      clearInterval(interval);
      if (idleTimer) clearTimeout(idleTimer);
      busyRef.current = false;
      sentenceRef.current = "";
      lastChunkAtRef.current = 0;
      speculativeRef.current = null;
      runFlushRef.current = null;
      if (hearing) onHearingRef.current?.(false);
      onTranscribingRef.current?.(false);
    };
    // interruptEpoch / resetEpoch must restart the poll — bumping sessionGen alone
    // used to leave stillActive() false forever after Ctrl+Enter screenshot solve.
  }, [
    enabled,
    paused,
    prefs?.apiUrl,
    prefs?.token,
    prefs?.meetingAudioLanguage,
    interruptEpoch,
    resetEpoch,
  ]);
}
