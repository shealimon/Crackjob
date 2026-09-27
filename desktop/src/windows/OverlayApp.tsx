import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AnswerProse } from "../components/AnswerProse";
import { BrandLogo } from "../components/BrandLogo";
import { AnswerLabel, QuestionLabel } from "../components/QaLabel";
import { HotkeyHint } from "../components/Kbd";
import { useScreenshotFlash } from "../hooks/useScreenshotFlash";
import { useWindowHotkeys } from "../hooks/useWindowHotkeys";
import { FREE_LIMIT_UPGRADE_MSG, FREE_PARTIAL_UPGRADE_MSG } from "../lib/constants";
import { highlightCode } from "../lib/highlightCode";
import {
  loadInterviewDay,
  localDateKey,
  type InterviewDayFile,
} from "../lib/interviewHistory";
import { captureInterviewHotkey, isInterviewActive, loadPrefs, requestSolve, setOverlayLayout, showOverlay, toggleOverlay } from "../lib/tauri";
import { parseInterviewDocument } from "../lib/api";
import type { Prefs } from "../lib/types";
import { isGenericQuestionLabel, pickDisplayQuestion } from "../lib/interviewSpeech";
import { scrollElement } from "../lib/scroll";
import type { AnswerEntry, AnswerSource, OverlayPayload } from "../lib/types";

/** Strip solve-count clutter; keep "Upgrade for Unlimited Access" on its own line. */
function formatUpgradeCopy(raw: string | null | undefined) {
  const text = (raw || "").trim();
  if (!text) return FREE_LIMIT_UPGRADE_MSG;
  const cleaned = text
    .replace(/\s*\(\d+\s*solves?\)\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (/upgrade for unlimited access/i.test(cleaned)) {
    const lead = cleaned
      .replace(/\.?\s*Upgrade for unlimited access\.?/i, "")
      .trim()
      .replace(/[.]+$/, "");
    return lead
      ? `${lead}.\nUpgrade for Unlimited Access.`
      : "Upgrade for Unlimited Access.";
  }
  return cleaned;
}

function CaptureFlash() {
  return (
    <div className="ic-shot-flash" aria-hidden>
      <span className="ic-shot-flash-wash" />
      <span className="ic-shot-flash-blade ic-shot-flash-blade-top" />
      <span className="ic-shot-flash-blade ic-shot-flash-blade-bot" />
      <span className="ic-shot-flash-cam">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12.5" r="3.4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M9 6.2 10.1 4.4h3.8L15 6.2" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l1.4 4.3H18l-3.5 2.6 1.3 4.3L12 12.8 8.2 13.2l1.3-4.3L6 6.3h4.6L12 2z"
        fill="currentColor"
      />
      <path
        d="M19 14l.7 2.1H22l-1.8 1.3.7 2.1L19 18.1l-1.9 1.4.7-2.1L16 16.1h2.3L19 14z"
        fill="currentColor"
        opacity="0.65"
      />
    </svg>
  );
}

function AttachIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21.4 11.6 12.1 21a5.1 5.1 0 0 1-7.2-7.2l9.9-9.9a3.4 3.4 0 1 1 4.8 4.8l-9.9 9.9a1.7 1.7 0 1 1-2.4-2.4l8.5-8.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DOCUMENT_ACCEPT =
  ".pdf,.doc,.docx,.txt,.md,.markdown,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/rtf";

type ChatDocument = { name: string; text: string };

type OverlayTab = "response" | "transcripts" | "history";

type FlatHistoryItem = {
  key: string;
  time: string;
  question: string;
  answer: string;
  source?: AnswerSource;
};

function flattenTodayHistory(day: InterviewDayFile | null): FlatHistoryItem[] {
  if (!day?.sessions?.length) return [];
  const items: FlatHistoryItem[] = [];
  for (const session of day.sessions) {
    for (const entry of session.entries) {
      const question = entry.question.trim();
      if (!question) continue;
      items.push({
        key: entry.id || `${day.date}-${session.sessionId}-${entry.time}`,
        time: entry.time,
        question,
        answer: entry.answer?.trim() || "",
      });
    }
  }
  return items;
}

function mergeTodayHistory(
  day: InterviewDayFile | null,
  liveAnswers: AnswerEntry[],
): FlatHistoryItem[] {
  const today = localDateKey();
  const byKey = new Map<string, FlatHistoryItem>();

  for (const item of flattenTodayHistory(day)) {
    byKey.set(item.key, item);
  }

  for (const entry of liveAnswers) {
    if (entry.streaming || entry.questionStreaming) continue;
    const answer = entry.result.solution.trim();
    if (!answer) continue;
    const entryDay = localDateKey(new Date(entry.at));
    if (entryDay !== today) continue;
    const question = displayQuestion(entry);
    if (!question || isGenericQuestionLabel(question)) continue;
    byKey.set(entry.id, {
      key: entry.id,
      time: new Date(entry.at).toISOString(),
      question,
      answer,
      source: entry.source,
    });
  }

  return [...byKey.values()]
    .filter((item) => item.answer.trim().length > 0)
    .sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
}

function formatHistoryTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayQuestion(entry: AnswerEntry) {
  const resolved = pickDisplayQuestion(
    entry.question,
    entry.result.headline || entry.result.problemSummary,
  );
  if (resolved) return resolved;
  if (entry.streaming || entry.questionStreaming || !entry.result.solution.trim()) {
    return "Reading question…";
  }
  return entry.question.trim() || "Question";
}

function canCopyQuestion(text: string) {
  return !isGenericQuestionLabel(text);
}

async function copyTextToClipboard(text: string) {
  const value = text.trim();
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = value;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyQuestionIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function CopyQuestionButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const onCopy = useCallback(() => {
    void (async () => {
      const ok = await copyTextToClipboard(text);
      if (!ok) return;
      setCopied(true);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1400);
    })();
  }, [text]);

  return (
    <button
      type="button"
      className={`ic-qa-copy${copied ? " is-copied" : ""}`}
      aria-label={copied ? "Question copied" : "Copy question"}
      title={copied ? "Copied" : "Copy question"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onCopy();
      }}
    >
      <CopyQuestionIcon copied={copied} />
    </button>
  );
}

function OverlayQuestion({
  text,
  source,
  interactiveHandsOn = false,
}: {
  text: string;
  source?: AnswerSource;
  interactiveHandsOn?: boolean;
}) {
  return (
    <div className="ic-qa-block">
      <QuestionLabel source={source ?? "voice"} interactiveHandsOn={interactiveHandsOn} />
      <div className="ic-qa-question-row">
        <p className="ic-qa-question">{text}</p>
        {canCopyQuestion(text) ? <CopyQuestionButton text={text} /> : null}
      </div>
    </div>
  );
}

function codeLanguageLabel(language: string) {
  const key = language.trim().toLowerCase();
  if (!key) return "Code";
  const labels: Record<string, string> = {
    python: "Python",
    py: "Python",
    javascript: "JavaScript",
    js: "JavaScript",
    typescript: "TypeScript",
    ts: "TypeScript",
    java: "Java",
    cpp: "C++",
    c: "C",
    csharp: "C#",
    cs: "C#",
    go: "Golang",
    golang: "Golang",
    rust: "Rust",
  };
  return labels[key] || language;
}

type SolutionSegment =
  | { kind: "prose"; text: string }
  | { kind: "code"; language: string; code: string };

/** Show API solution in order — prose and fenced code as returned (no old DSA split layout). */
function parseSolutionSegments(solution: string): SolutionSegment[] {
  const text = solution.replace(/\r\n/g, "\n");
  const fenceRe = /```([^\n`]*)\n([\s\S]*?)```/g;
  const segments: SolutionSegment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(text)) !== null) {
    const before = text.slice(last, match.index).trim();
    if (before) segments.push({ kind: "prose", text: before });
    segments.push({
      kind: "code",
      language: match[1]?.trim() || "",
      code: match[2].replace(/\n$/, ""),
    });
    last = match.index + match[0].length;
  }

  const open = text.slice(last).match(/^([\s\S]*?)```([^\n`]*)\n([\s\S]*)$/);
  if (open && !open[0].includes("```", open[0].indexOf("\n") + 1)) {
    const before = open[1].trim();
    if (before) segments.push({ kind: "prose", text: before });
    segments.push({
      kind: "code",
      language: open[2]?.trim() || "",
      code: open[3].replace(/\n$/, ""),
    });
    return segments;
  }

  const rest = text.slice(last).trim();
  if (rest) segments.push({ kind: "prose", text: rest });
  return segments;
}

function CodePane({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  return (
    <aside className="ic-code-pane">
      <div className="ic-code-head">{codeLanguageLabel(language)}</div>
      <pre className="ic-code-body">
        <code>{highlightCode(code, language)}</code>
      </pre>
    </aside>
  );
}

function SolutionBody({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const segments = useMemo(() => parseSolutionSegments(text), [text]);
  if (!segments.length) return null;

  return (
    <div className="ic-qa-block">
      <AnswerLabel />
      <div className="ic-qa-answer">
        {segments.map((segment, index) =>
          segment.kind === "code" ? (
            <CodePane key={`code-${index}`} code={segment.code} language={segment.language} />
          ) : (
            <AnswerProse
              key={`prose-${index}`}
              text={segment.text}
              streaming={streaming && index === segments.length - 1}
            />
          ),
        )}
      </div>
    </div>
  );
}

/** Empty Start state — roomy panel before Q&A arrives (includes chat composer). */
const OVERLAY_IDLE_HEIGHT = 540;
/** Floor once content is measuring (short answers can shrink below idle). */
const OVERLAY_CONTENT_MIN_HEIGHT = 220;

function measureCompactWindowHeight(wrap: HTMLElement) {
  const panel = wrap.querySelector(".ic-response-panel") as HTMLElement | null;
  if (!panel) return wrap.scrollHeight;
  const head = panel.querySelector(".ic-response-head") as HTMLElement | null;
  const body = panel.querySelector(".ic-response-body") as HTMLElement | null;
  const foot = panel.querySelector(".ic-response-foot-wrap") as HTMLElement | null;

  // Measure real children — body is flex:1 so scrollHeight stays at the
  // current window size and would never shrink after the idle Start height.
  let bodyH = 0;
  if (body) {
    const styles = getComputedStyle(body);
    const pad =
      (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
    const kids = Array.from(body.children) as HTMLElement[];
    if (kids.length === 0) {
      bodyH = pad;
    } else {
      const first = kids[0];
      const last = kids[kids.length - 1];
      bodyH = last.offsetTop + last.offsetHeight - first.offsetTop + pad;
    }
  }

  return (head?.offsetHeight ?? 0) + bodyH + (foot?.offsetHeight ?? 0) + 20;
}

function answerHasCode(solution: string) {
  return /```/.test(solution);
}

export function OverlayApp() {
  const [payload, setPayload] = useState<OverlayPayload | null>(null);
  const [tab, setTab] = useState<OverlayTab>("response");
  const [opacity, setOpacity] = useState(0.75);
  const [apiBase, setApiBase] = useState("");
  const [historyDay, setHistoryDay] = useState<InterviewDayFile | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatDocument, setChatDocument] = useState<ChatDocument | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [, setPrefs] = useState<Prefs | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatDocumentRef = useRef<ChatDocument | null>(null);
  const lastLayoutHeightRef = useRef(0);
  /** Global shortcut + window keydown can both fire — collapse to one toggle. */
  const lastHistoryToggleAtRef = useRef(0);
  const lastChatSubmitAtRef = useRef(0);
  const shotFlash = useScreenshotFlash(320);
  const interviewActiveRef = useRef(false);

  const openUpgrade = useCallback(() => {
    const base = apiBase.replace(/\/$/, "") || "https://www.crackinterviewai.in";
    void openUrl(`${base}/dashboard`);
  }, [apiBase]);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const day = await loadInterviewDay(localDateKey());
      setHistoryDay(day);
    } catch {
      setHistoryDay(null);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const toggleHistory = useCallback(() => {
    const now = Date.now();
    if (now - lastHistoryToggleAtRef.current < 280) return;
    lastHistoryToggleAtRef.current = now;

    setTab((prev) => {
      const next = prev === "history" ? "response" : "history";
      if (next === "history") {
        void showOverlay().catch(() => undefined);
        void refreshHistory();
      }
      return next;
    });
  }, [refreshHistory]);

  const syncChatDraft = useCallback((text: string, document: ChatDocument | null = chatDocumentRef.current) => {
    void emit("chat-question-draft", {
      text,
      document: document ? { name: document.name, text: document.text } : null,
    }).catch(() => undefined);
  }, []);

  const setDocument = useCallback(
    (doc: ChatDocument | null) => {
      chatDocumentRef.current = doc;
      setChatDocument(doc);
      syncChatDraft(chatText, doc);
    },
    [chatText, syncChatDraft],
  );

  const submitChatQuestion = useCallback(
    (raw?: string) => {
      const now = Date.now();
      if (now - lastChatSubmitAtRef.current < 350) return;
      lastChatSubmitAtRef.current = now;

      const text = (raw ?? chatText).trim();
      const document = chatDocumentRef.current;
      if (!text && !document?.text?.trim()) return;

      setChatText("");
      chatDocumentRef.current = null;
      setChatDocument(null);
      syncChatDraft("", null);
      void showOverlay().catch(() => undefined);
      setTab("response");
      void emit("chat-question-submit", {
        text,
        document: document ? { name: document.name, text: document.text } : null,
      }).catch(() => undefined);
    },
    [chatText, syncChatDraft],
  );

  const onChatChange = useCallback(
    (value: string) => {
      setChatText(value);
      syncChatDraft(value, chatDocumentRef.current);
    },
    [syncChatDraft],
  );

  const onChatKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key !== "Enter" && event.code !== "Enter" && event.code !== "NumpadEnter") {
        return;
      }
      // Draft is already synced; prevent newline. Window/global Ctrl+Enter runs solve.
      event.preventDefault();
    },
    [],
  );

  const onPickDocument = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onDocumentSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      setDocUploading(true);
      void (async () => {
        try {
          // Overlay can keep a pre-login token; always read fresh prefs (login revokes old sessions).
          const fresh = await loadPrefs();
          setPrefs(fresh);
          if (!fresh.token) {
            throw new Error("Sign in again, then attach the file.");
          }
          const { text, filename, truncated } = await parseInterviewDocument(fresh, file);
          setDocument({ name: filename, text });
          if (truncated) {
            window.alert(
              `Document loaded but trimmed for length (${text.length.toLocaleString()} chars).`,
            );
          }
        } catch (err) {
          window.alert(err instanceof Error ? err.message : "Could not read document");
        } finally {
          setDocUploading(false);
        }
      })();
    },
    [setDocument],
  );

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    const track = (register: Promise<() => void>) => {
      void register.then((fn) => {
        if (cancelled) fn();
        else unsubs.push(fn);
      });
    };

    void loadPrefs()
      .then((loaded) => {
        setPrefs(loaded);
        setOpacity(loaded.overlayOpacity);
        setApiBase(loaded.apiUrl.replace(/\/$/, ""));
      })
      .catch(() => undefined);
    void isInterviewActive()
      .then((active) => {
        if (!cancelled) interviewActiveRef.current = active;
      })
      .catch(() => undefined);
    track(
      listen<{ active: boolean }>("interview-active", (event) => {
        interviewActiveRef.current = Boolean(event.payload.active);
      }),
    );
    track(
      listen<OverlayPayload>("overlay-update", (event) => {
        setPayload((prev) => {
          const next = { ...(prev ?? {}), ...event.payload } as OverlayPayload;
          if (event.payload.answerHistory) {
            const incoming = event.payload.answerHistory;
            const prevDraft = prev?.answerHistory?.find((entry) => entry.questionStreaming);
            const incomingDraft = incoming.find((entry) => entry.questionStreaming);
            // Stale transcript/audio-status emits can omit a brand-new live draft id —
            // keep the draft so the Question section does not flash empty.
            // Empty history is an intentional clear (Ctrl+G) — do not revive drafts.
            if (incoming.length === 0) {
              next.answerHistory = [];
            } else if (
              prevDraft &&
              !incomingDraft &&
              !incoming.some((entry) => entry.id === prevDraft.id)
            ) {
              next.answerHistory = [prevDraft, ...incoming];
            } else {
              next.answerHistory = incoming;
            }
          }
          // Only sticky-preserve when the update omitted the field entirely.
          // Explicit false from overlayMeta must clear a leftover pending capture.
          if (event.payload.screenshotPending === undefined && prev?.screenshotPending) {
            next.screenshotPending = prev.screenshotPending;
          }
          // Explicit null clears a previous answer when a new analyze starts.
          if (event.payload.result === null) {
            next.result = null;
          }
          if (event.payload.error === null) {
            next.error = null;
          } else if (event.payload.error === undefined && (event.payload.analyzing || event.payload.streaming)) {
            next.error = null;
          } else if (
            event.payload.error === undefined &&
            next.answerHistory?.some((entry) => entry.questionStreaming && entry.question.trim())
          ) {
            // Drop sticky "wait for question" errors once live audio text is showing.
            next.error = null;
          }
          return next;
        });
        const hasLiveQuestion = Boolean(
          event.payload.answerHistory?.some((entry) => entry.questionStreaming && entry.question.trim()),
        );
        // Jump to Response for explicit solve/capture focus — not live-Q ticks
        // (those would immediately close Ctrl+Y History).
        // Audio play/pause must not change tabs — listening is capture-only.
        if (
          event.payload.focusResponse ||
          event.payload.streaming ||
          event.payload.screenshotPending
        ) {
          setTab("response");
        } else if (hasLiveQuestion) {
          setTab((prev) => (prev === "history" ? prev : "response"));
        }
      }),
    );
    track(
      listen("start-over", () => {
        // Ctrl+G: wipe Response questions, answers, and screenshot state.
        setPayload((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            analyzing: false,
            streaming: false,
            error: null,
            result: null,
            answerHistory: [],
            transcripts: [],
            hasScreenshot: false,
            screenshotPending: false,
          };
        });
        setChatText("");
        chatDocumentRef.current = null;
        setChatDocument(null);
        setTab("response");
      }),
    );
    track(
      listen("toggle-history", () => {
        toggleHistory();
      }),
    );
    track(
      listen("prefs-updated", () => {
        void loadPrefs()
          .then((loaded) => {
            setPrefs(loaded);
            setOpacity(loaded.overlayOpacity);
            setApiBase(loaded.apiUrl.replace(/\/$/, ""));
          })
          .catch(() => undefined);
      }),
    );
    track(
      listen("chat-question-cleared", () => {
        setChatText("");
        chatDocumentRef.current = null;
        setChatDocument(null);
      }),
    );
    track(
      listen<{ opacity: number }>("overlay-opacity", (event) => {
        setOpacity(event.payload.opacity);
      }),
    );
    track(
      listen<{ dx: number; dy: number }>("overlay-scroll", (event) => {
        const el = bodyRef.current;
        if (!el) return;
        scrollElement(el, event.payload.dx, event.payload.dy);
      }),
    );
    return () => {
      cancelled = true;
      unsubs.forEach((fn) => fn());
    };
  }, [toggleHistory]);

  const answerHistory = (payload?.answerHistory ?? []).filter((entry) => {
    if (entry.streaming || entry.questionStreaming || entry.result.solution.trim()) return true;
    return !isGenericQuestionLabel(entry.question);
  });
  const historyItems = useMemo(
    () => mergeTodayHistory(historyDay, answerHistory),
    [historyDay, answerHistory],
  );
  const topAnswerId = answerHistory[0]?.id;
  const showUpgradeCta =
    tab === "response" &&
    (Boolean(payload?.upgradeRequired) ||
      Boolean(payload?.partialAnswer) ||
      answerHistory.some((entry) => entry.partialAnswer && entry.id === topAnswerId));
  const upgradeCopy = formatUpgradeCopy(
    payload?.upgradePrompt ||
      answerHistory.find((entry) => entry.id === topAnswerId)?.upgradePrompt ||
      (payload?.error?.includes("Upgrade") ? payload.error : null) ||
      FREE_PARTIAL_UPGRADE_MSG,
  );

  const wantsWideLayout = useMemo(() => {
    if (tab === "history") {
      return historyItems.some((item) => answerHasCode(item.answer));
    }
    if (tab !== "response") return false;
    return answerHistory.some((entry) => answerHasCode(entry.result.solution));
  }, [tab, answerHistory, historyItems]);

  const hasCompactContent =
    tab === "history" ||
    answerHistory.length > 0 ||
    Boolean(payload?.error) ||
    Boolean(showUpgradeCta) ||
    (tab === "transcripts" && (payload?.transcripts?.length ?? 0) > 0);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const applyLayout = () => {
      if (wantsWideLayout) {
        lastLayoutHeightRef.current = 0;
        void setOverlayLayout(false).catch(() => undefined);
        return;
      }
      // Start / empty: large fixed panel. With Q&A: flex to content height.
      const nextHeight = hasCompactContent
        ? Math.max(measureCompactWindowHeight(wrap), OVERLAY_CONTENT_MIN_HEIGHT)
        : OVERLAY_IDLE_HEIGHT;
      if (Math.abs(nextHeight - lastLayoutHeightRef.current) < 8) return;
      lastLayoutHeightRef.current = nextHeight;
      void setOverlayLayout(true, nextHeight).catch(() => undefined);
    };

    applyLayout();
    const observer = new ResizeObserver(applyLayout);
    observer.observe(wrap);
    const body = wrap.querySelector(".ic-response-body");
    if (body) observer.observe(body);

    return () => observer.disconnect();
  }, [wantsWideLayout, tab, payload, answerHistory, hasCompactContent]);

  // Only jump to top when a new answer becomes primary — never while streaming
  // updates append text (that would yank the candidate away mid-read).
  useEffect(() => {
    if (!bodyRef.current || !topAnswerId) return;
    bodyRef.current.scrollTop = 0;
  }, [topAnswerId]);

  const onCapture = useCallback(() => {
    if (!interviewActiveRef.current) return;
    void captureInterviewHotkey().catch(() => undefined);
  }, []);
  const onSolve = useCallback(() => {
    void requestSolve().catch(() => undefined);
  }, []);
  const onToggle = useCallback(() => {
    void toggleOverlay().catch(() => undefined);
  }, []);
  const onReset = useCallback(() => {
    void emit("start-over").catch(() => undefined);
  }, []);
  const onHistory = useCallback(() => {
    toggleHistory();
  }, [toggleHistory]);

  useWindowHotkeys({
    onCapture,
    onSolve,
    onToggle,
    onReset,
    onHistory,
  });

  return (
    <div
      ref={wrapRef}
      className="ic-response-wrap"
      style={{ ["--panel-alpha" as string]: String(opacity) }}
    >
      <section className={`ic-response-panel${wantsWideLayout ? " is-wide" : " is-compact"}`}>
        {shotFlash > 0 ? <CaptureFlash key={shotFlash} /> : null}
        <header className="ic-response-head" data-tauri-drag-region>
          <div className="ic-response-tabs" data-tauri-drag-region>
            <BrandLogo size={22} />
            <HotkeyHint
              label="Response"
              icon="response"
              active={tab === "response"}
              onClick={() => setTab("response")}
            />
            <HotkeyHint
              label="Transcripts"
              icon="transcripts"
              active={tab === "transcripts"}
              onClick={() => setTab("transcripts")}
            />
          </div>

          <HotkeyHint
            label="History"
            keys={["Ctrl", "Y"]}
            icon="history"
            active={tab === "history"}
            onClick={() => {
              if (tab === "history") {
                setTab("response");
              } else {
                setTab("history");
                void refreshHistory();
              }
            }}
          />
        </header>

        <div ref={bodyRef} className="ic-response-body">
          {payload?.error ? <p className="ic-overlay-error">{payload.error}</p> : null}
          {tab === "history" ? (
            historyLoading ? (
              <p className="ic-empty-copy">Loading history…</p>
            ) : historyItems.length ? (
              <div className="ic-answer-stack ic-history-stack">
                {historyItems.map((item) => (
                  <article key={item.key} className="ic-answer">
                    <p className="ic-history-meta">{formatHistoryTime(item.time)}</p>
                    <OverlayQuestion text={item.question} source={item.source ?? "voice"} />
                    {item.answer ? <SolutionBody text={item.answer} /> : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="ic-empty-copy">No questions answered today yet.</p>
            )
          ) : tab === "transcripts" ? (
            payload?.transcripts?.length ? (
              <div className="ic-transcripts">
                {payload.transcripts.map((entry) => (
                  <p key={entry.at} className="ic-transcript-line">
                    {entry.role === "interviewer" ? (
                      <span className="ic-transcript-role ic-transcript-role-interviewer">Interviewer · </span>
                    ) : entry.role === "candidate" ? (
                      <span className="ic-transcript-role ic-transcript-role-candidate">You · </span>
                    ) : null}
                    {entry.text}
                  </p>
                ))}
              </div>
            ) : null
          ) : (
            <>
              {answerHistory.length ? (
                <div className="ic-answer-stack">
                  {answerHistory.map((entry) => (
                      <article
                        key={entry.id}
                        className={`ic-answer${
                          entry.streaming || entry.questionStreaming ? " ic-answer-live" : ""
                        }`}
                      >
                        <OverlayQuestion
                          text={displayQuestion(entry)}
                          source={entry.source ?? "voice"}
                          interactiveHandsOn={entry.interactiveHandsOn}
                        />
                        {!entry.questionStreaming || entry.result.solution ? (
                          <SolutionBody
                            text={entry.result.solution}
                            streaming={entry.streaming}
                          />
                        ) : null}
                        {entry.partialAnswer && entry.id === topAnswerId && !entry.streaming ? (
                          <div className="ic-upgrade-block">
                            <p>{formatUpgradeCopy(entry.upgradePrompt || FREE_PARTIAL_UPGRADE_MSG)}</p>
                            <button
                              type="button"
                              className="ic-btn ic-btn-glass ic-btn-upgrade ic-upgrade-wide"
                              onClick={openUpgrade}
                            >
                              <SparkleIcon />
                              <span className="ic-btn-upgrade-label">Upgrade</span>
                              <span className="ic-pro-badge">PRO</span>
                            </button>
                          </div>
                        ) : null}
                      </article>
                  ))}
                </div>
              ) : null}
              {showUpgradeCta &&
              !answerHistory.some((entry) => entry.partialAnswer && entry.id === topAnswerId) ? (
                <div className="ic-upgrade-block">
                  <p>{upgradeCopy || formatUpgradeCopy(FREE_LIMIT_UPGRADE_MSG)}</p>
                  <button
                    type="button"
                    className="ic-btn ic-btn-glass ic-btn-upgrade ic-upgrade-wide"
                    onClick={openUpgrade}
                  >
                    <SparkleIcon />
                    <span className="ic-btn-upgrade-label">Upgrade</span>
                    <span className="ic-pro-badge">PRO</span>
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="ic-response-foot-wrap">
          <div className="ic-chat-composer">
            <input
              ref={fileInputRef}
              type="file"
              className="ic-chat-file-input"
              accept={DOCUMENT_ACCEPT}
              tabIndex={-1}
              onChange={onDocumentSelected}
            />
            <div className="ic-chat-field">
              <button
                type="button"
                className={`ic-chat-attach${chatDocument || docUploading ? " is-active" : ""}`}
                aria-label="Attach document"
                title="Attach PDF, DOCX, or text file"
                disabled={docUploading}
                onClick={onPickDocument}
              >
                <AttachIcon />
              </button>
              {docUploading ? (
                <span className="ic-chat-doc-chip">Reading file…</span>
              ) : chatDocument ? (
                <span className="ic-chat-doc-chip" title={chatDocument.name}>
                  <span className="ic-chat-doc-name">{chatDocument.name}</span>
                  <button
                    type="button"
                    className="ic-chat-doc-remove"
                    aria-label="Remove attachment"
                    onClick={() => setDocument(null)}
                  >
                    ×
                  </button>
                </span>
              ) : null}
              <textarea
                className="ic-chat-input"
                value={chatText}
                rows={1}
                placeholder={
                  chatDocument
                    ? "Add a question about this file, then press Ctrl+Enter for the answer…"
                    : "Type or paste the question, then press Ctrl+Enter for the answer…"
                }
                aria-label="Type or paste an interview question"
                onChange={(event) => onChatChange(event.target.value)}
                onKeyDown={onChatKeyDown}
              />
              <HotkeyHint
                label="Answer"
                keys={["Ctrl", "Enter"]}
                icon="solve"
                onClick={() => {
                  if (chatText.trim() || chatDocument?.text?.trim()) {
                    submitChatQuestion();
                  }
                }}
              />
            </div>
          </div>
          <footer className="ic-response-foot">
            <HotkeyHint label="Scroll Up" keys={["Ctrl", "Shift", "↑"]} icon="scroll" />
            <HotkeyHint label="Scroll Down" keys={["Ctrl", "Shift", "↓"]} icon="scrollDown" />
            <HotkeyHint label="Clear output" keys={["Ctrl", "G"]} icon="reset" />
          </footer>
        </div>
      </section>
    </div>
  );
}
