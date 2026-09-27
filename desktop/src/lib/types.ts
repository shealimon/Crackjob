import type { InterviewModeId } from "./constants";

export type {
  InteractiveHandsOnCapability,
  TaskContext,
  TaskSession,
} from "./taskSession";

export type SolveResult = {
  headline: string;
  problemSummary: string;
  approach: string[];
  solution: string;
  complexity?: { time: string; space: string };
  talkingPoints: string[];
  followUps: string[];
  pitfalls: string[];
};

export type AnalyzeResponse = {
  jobId?: string;
  mode: InterviewModeId;
  demo?: boolean;
  creditsUsed: number;
  creditBalance: number;
  creditsLow?: boolean;
  exploreRemaining?: number | null;
  solvesToday?: number;
  answerTier?: "full" | "partial" | "blocked" | null;
  fullAccess?: boolean;
  plan?: string;
  planStatus?: string;
  endsAt?: string | null;
  partialAnswer?: boolean;
  upgradePrompt?: string | null;
  upgradeRequired?: boolean;
  usage?: { inputTokens: number; outputTokens: number };
  result: SolveResult;
  error?: string;
};

export type TranscriptEntry = {
  text: string;
  at: number;
  role?: "interviewer" | "candidate" | "unknown";
};

/**
 * How the question was captured.
 * Interactive / Hands-on is a session capability (`interactiveHandsOn` / TaskSession),
 * not a fourth AnswerSource or InterviewModeId.
 */
export type AnswerSource = "voice" | "screenshot" | "text";

export type AnswerEntry = {
  id: string;
  question: string;
  result: SolveResult;
  at: number;
  streaming?: boolean;
  questionStreaming?: boolean;
  /** Free explore teaser (questions 11–15): half answer + upgrade CTA. */
  partialAnswer?: boolean;
  upgradePrompt?: string | null;
  /** How the question was captured — drives the Q label icon. */
  source?: AnswerSource;
  /** Interactive / Hands-on capability solve (not an InterviewModeId). */
  interactiveHandsOn?: boolean;
};

export type OverlayPayload = {
  mode: InterviewModeId;
  companyPack: string;
  analyzing?: boolean;
  streaming?: boolean;
  error?: string | null;
  creditsUsed?: number;
  creditBalance?: number;
  creditsLow?: boolean;
  usage?: { inputTokens: number; outputTokens: number };
  result?: SolveResult | null;
  answerHistory?: AnswerEntry[];
  hasScreenshot?: boolean;
  screenshotPending?: boolean;
  /** Interactive / Hands-on capability armed for this interview. */
  interactiveHandsOn?: boolean;
  transcripts?: TranscriptEntry[];
  listening?: boolean;
  audioHearing?: boolean;
  /** True while Whisper/STT is converting buffered speech to text. */
  audioTranscribing?: boolean;
  audioStatus?: AudioStatus | null;
  focusResponse?: boolean;
  partialAnswer?: boolean;
  upgradePrompt?: string | null;
  upgradeRequired?: boolean;
};

export type UserProfile = {
  id: string;
  name: string | null;
  email: string | null;
  creditBalance: number;
  creditsLow?: boolean;
  plan?: string;
  planStatus?: string;
  endsAt?: string | null;
  fullAccess?: boolean;
  exploreRemaining?: number | null;
  solvesToday?: number;
  answerTier?: "full" | "partial" | "blocked" | null;
};

export type StealthStatus = {
  supportsAudio: boolean;
  invisibleInDock: boolean;
  invisibleToScreenShare: boolean;
  invisibleToTray: boolean;
  invisibleToActivityMonitor: boolean;
  clickThrough: boolean;
  undetectableByBrowser: boolean;
  allActive: boolean;
  platform: string;
  captureProtectedWindows: number;
  audioCapturing: boolean;
  /** Entire-screen share: OS cursor hidden; local-only pointer drawn in UI. */
  localCursorActive: boolean;
};

export type Prefs = {
  apiUrl: string;
  token: string | null;
  deviceId: string;
  mode: InterviewModeId;
  companyPack: string;
  outputLanguage: string;
  codeLanguage: string;
  meetingAudioLanguage: string;
  overlayOpacity: number;
  clickThrough: boolean;
  resumeText: string;
  rememberMe: boolean;
  rememberedEmail: string;
  rememberedPassword: string;
};

export type AudioStatus = {
  available: boolean;
  capturing: boolean;
  speaking?: boolean;
  backend: string;
  frames: number;
  bufferedMs?: number;
  note: string;
  error?: string | null;
};

export type AudioChunk = {
  audioBase64: string;
  durationMs: number;
  sampleRate: number;
};
