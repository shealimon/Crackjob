import type { AnalyzeResponse, Prefs, UserProfile } from "./types";
import type { InterviewModeId } from "./constants";
import type { TaskContext } from "./taskSession";

export class ApiError extends Error {
  status: number;
  creditsLow?: boolean;
  creditBalance?: number;

  constructor(
    message: string,
    status: number,
    extra?: { creditsLow?: boolean; creditBalance?: number },
  ) {
    super(message);
    this.status = status;
    this.creditsLow = extra?.creditsLow;
    this.creditBalance = extra?.creditBalance;
  }
}

/** Next 16 + Turbopack dev can 404 POST /api/* with "Failed to find Server Action". */
function devApiRouteMissingMessage(status: number, label: string): string | null {
  if (status !== 404) return null;
  return `${label} API returned 404. Restart the website dev server (npm run dev in website/) and retry. Avoid npm run dev:turbo while using the desktop app.`;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    throw new ApiError(
      `API returned HTML (${res.status}). Is the website running on the API URL?`,
      res.status,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(
      text.slice(0, 120) || `Invalid API response (${res.status})`,
      res.status,
    );
  }
}

/** In dev, call the Vite proxy on :1420 so WebView fetch stays same-origin. */
function apiBase(prefs: Prefs): string {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return window.location.origin;
  }
  return prefs.apiUrl.replace(/\/$/, "");
}

export async function desktopEmailLogin(prefs: Prefs, email: string, password: string) {
  const res = await fetch(`${apiBase(prefs)}/api/auth/desktop-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      deviceId: prefs.deviceId,
      platform: "Windows",
    }),
  });
  const body = await parseJson<{
    token?: string;
    user?: UserProfile;
    error?: string;
  }>(res);
  if (!res.ok || !body.token || !body.user) {
    throw new ApiError(body.error || "Could not sign in", res.status);
  }
  return { token: body.token, user: body.user };
}

function isRealAuthUser(user: UserProfile): boolean {
  const email = user.email?.trim().toLowerCase();
  return Boolean(email && email !== "dev@localhost");
}

/**
 * Validate a saved bearer token against `/api/user`.
 * Call on Start Interview (not at app boot / login) so restored sessions
 * defer network until the user begins an interview.
 */
export async function ensureDesktopSession(prefs: Prefs): Promise<{
  prefs: Prefs;
  user: UserProfile | null;
  needsLogin: boolean;
}> {
  if (!prefs.token) {
    return { prefs, user: null, needsLogin: true };
  }

  try {
    const user = await fetchUser(prefs);
    if (!isRealAuthUser(user)) {
      const cleared = { ...prefs, token: null };
      return { prefs: cleared, user: null, needsLogin: true };
    }
    return { prefs, user, needsLogin: false };
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 401)) {
      throw err;
    }
    const cleared = { ...prefs, token: null };
    return { prefs: cleared, user: null, needsLogin: true };
  }
}

/** Apply access fields from an analyze response onto the local profile. */
export function mergeAccessIntoUser(
  profile: UserProfile,
  patch: {
    creditBalance?: number;
    creditsLow?: boolean;
    exploreRemaining?: number | null;
    solvesToday?: number;
    answerTier?: UserProfile["answerTier"];
    fullAccess?: boolean;
    plan?: string;
    planStatus?: string;
    endsAt?: string | null;
  },
): UserProfile {
  const fullAccess =
    typeof patch.fullAccess === "boolean" ? patch.fullAccess : Boolean(profile.fullAccess);
  return {
    ...profile,
    fullAccess,
    plan: patch.plan ?? profile.plan,
    planStatus: patch.planStatus ?? profile.planStatus,
    endsAt: patch.endsAt !== undefined ? patch.endsAt : profile.endsAt,
    creditBalance:
      typeof patch.creditBalance === "number" ? patch.creditBalance : profile.creditBalance,
    creditsLow:
      typeof patch.creditsLow === "boolean" ? patch.creditsLow : profile.creditsLow,
    exploreRemaining: fullAccess
      ? null
      : patch.exploreRemaining !== undefined
        ? patch.exploreRemaining
        : profile.exploreRemaining,
    solvesToday:
      typeof patch.solvesToday === "number" ? patch.solvesToday : profile.solvesToday,
    answerTier:
      patch.answerTier !== undefined
        ? patch.answerTier
        : fullAccess
          ? null
          : profile.answerTier,
  };
}

/** Run an authenticated API call. 401 means the user must sign in again. */
export async function withDesktopSessionRetry<T>(
  prefs: Prefs,
  run: (prefs: Prefs) => Promise<T>,
): Promise<{ result: T; prefs: Prefs; user?: UserProfile }> {
  return { result: await run(prefs), prefs };
}

export async function fetchUser(prefs: Prefs): Promise<UserProfile> {
  const res = await fetch(`${apiBase(prefs)}/api/user`, {
    headers: { Authorization: `Bearer ${prefs.token}` },
  });
  const body = await parseJson<UserProfile & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error || "Session expired", res.status);
  }
  return body;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Analyze stream request body.
 * Text + image + taskContext may be sent together (Interactive / Hands-on).
 * All Interactive fields are optional for backward compatibility.
 */
export type AnalyzeStreamInput = {
  mode: InterviewModeId;
  questionText?: string;
  imageBase64?: string;
  companyPack?: string;
  extraContext?: string;
  conversationContext?: string;
  documentContext?: string;
  documentName?: string;
  source?: "voice" | "screenshot" | "text";
  /** Compact AI-facing Interactive context — not a full TaskSession dump. */
  taskContext?: TaskContext;
  /** Session capability flag — not an InterviewModeId / domain. */
  interactiveHandsOn?: boolean;
};

export async function analyzeQuestionStream(
  prefs: Prefs,
  input: AnalyzeStreamInput,
  onEvent: (event: StreamAnalyzeEvent) => void,
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (prefs.token) {
    headers.Authorization = `Bearer ${prefs.token}`;
  }

  const res = await fetch(`${apiBase(prefs)}/api/ai/analyze/stream`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      mode: input.mode,
      questionText: input.questionText,
      imageBase64: input.imageBase64,
      mimeType: input.imageBase64 ? "image/jpeg" : undefined,
      companyPack: input.companyPack || undefined,
      outputLanguage: prefs.outputLanguage,
      codeLanguage: prefs.codeLanguage,
      extraContext: input.extraContext || undefined,
      conversationContext: input.conversationContext || undefined,
      documentContext: input.documentContext || undefined,
      documentName: input.documentName || undefined,
      source: input.source || undefined,
      taskContext: input.taskContext || undefined,
      interactiveHandsOn: input.interactiveHandsOn || undefined,
    }),
  });

  if (!res.ok) {
    const routeHint = devApiRouteMissingMessage(res.status, "Analyze");
    const body = await parseJson<AnalyzeResponse & { error?: string }>(res).catch(() => ({
      error: routeHint || "Analyze failed",
    }));
    throw new ApiError(routeHint || body.error || "Analyze failed", res.status, {
      creditsLow: "creditsLow" in body ? body.creditsLow : undefined,
      creditBalance: "creditBalance" in body ? body.creditBalance : undefined,
    });
  }

  if (!res.body) {
    throw new ApiError("No stream body", 500);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResponse: AnalyzeResponse | null = null;

  while (true) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => undefined);
      throw new DOMException("Aborted", "AbortError");
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as StreamAnalyzeEvent;
      if (event.type === "error") {
        throw new ApiError(event.error || "Analyze failed", event.status ?? 500);
      }
      onEvent(event);
      if (event.type === "done") {
        finalResponse = {
          jobId: event.jobId,
          mode: event.mode,
          demo: event.demo,
          creditsUsed: event.creditsUsed,
          creditBalance: event.creditBalance,
          creditsLow: event.creditsLow,
          exploreRemaining: event.exploreRemaining,
          solvesToday: event.solvesToday,
          answerTier: event.answerTier,
          fullAccess: event.fullAccess,
          plan: event.plan,
          planStatus: event.planStatus,
          endsAt: event.endsAt,
          partialAnswer: event.partialAnswer,
          upgradePrompt: event.upgradePrompt,
          upgradeRequired: event.upgradeRequired,
          usage: event.usage,
          result: event.result,
        };
      }
    }
  }

  if (!finalResponse) {
    throw new ApiError("Stream ended without a result", 500);
  }

  return finalResponse;
}

export type StreamAnalyzeEvent =
  | { type: "start"; jobId: string; mode: InterviewModeId }
  | {
      type: "delta";
      result: AnalyzeResponse["result"];
      partialAnswer?: boolean;
      upgradePrompt?: string | null;
    }
  | {
      type: "done";
      jobId: string;
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
      result: AnalyzeResponse["result"];
    }
  | { type: "error"; error: string; status?: number; jobId?: string };

export async function transcribeAudio(
  prefs: Prefs,
  audioBase64: string,
  language?: string,
  onPartial?: (text: string) => void,
): Promise<{ text: string; durationSec: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (prefs.token) {
    headers.Authorization = `Bearer ${prefs.token}`;
  }

  // JSON POST (not multipart) — Next.js dev can mis-route multipart POSTs to Server Actions (404).
  const res = await fetch(`${apiBase(prefs)}/api/ai/transcribe`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      audioBase64,
      language: language || prefs.meetingAudioLanguage || "english",
      stream: Boolean(onPartial),
    }),
  });

  const contentType = res.headers.get("content-type") || "";
  if (onPartial && contentType.includes("text/event-stream") && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalText = "";
    let durationSec = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.startsWith("data:"));
        if (!line) continue;
        const raw = line.replace(/^data:\s*/, "");
        try {
          const evt = JSON.parse(raw) as {
            type?: string;
            text?: string;
            durationSec?: number;
            error?: string;
            status?: number;
          };
          if (evt.type === "partial" && evt.text?.trim()) {
            onPartial(evt.text.trim());
          } else if (evt.type === "done") {
            finalText = evt.text?.trim() || finalText;
            durationSec = evt.durationSec ?? 0;
            if (finalText) onPartial(finalText);
          } else if (evt.type === "error") {
            throw new ApiError(evt.error || "Transcription failed", evt.status ?? 500);
          }
        } catch (err) {
          if (err instanceof ApiError) throw err;
        }
      }
    }

    if (!res.ok && !finalText) {
      const routeHint = devApiRouteMissingMessage(res.status, "Transcription");
      throw new ApiError(routeHint || "Transcription failed", res.status);
    }
    return { text: finalText, durationSec };
  }

  const body = await parseJson<{ text?: string; durationSec?: number; error?: string }>(res);
  if (!res.ok) {
    const routeHint = devApiRouteMissingMessage(res.status, "Transcription");
    throw new ApiError(routeHint || body.error || "Transcription failed", res.status);
  }
  const text = body.text?.trim() || "";
  if (text && onPartial) onPartial(text);
  return { text, durationSec: body.durationSec ?? 0 };
}

export async function parseResumeUpload(
  prefs: Prefs,
  file: File,
): Promise<{ text: string; truncated?: boolean; charCount: number }> {
  const headers: Record<string, string> = {};
  if (prefs.token) {
    headers.Authorization = `Bearer ${prefs.token}`;
  }

  const form = new FormData();
  form.append("file", file);

  // Signed-in: store on profile so website + desktop answers share the same CV.
  if (prefs.token) {
    const uploadRes = await fetch(`${apiBase(prefs)}/api/resume/upload`, {
      method: "POST",
      headers,
      body: form,
    });
    const uploadBody = await parseJson<{ error?: string }>(uploadRes);
    if (!uploadRes.ok) {
      throw new ApiError(uploadBody.error || "Could not upload resume", uploadRes.status);
    }
    const synced = await fetchResume(prefs);
    if (!synced.resumeText) {
      throw new ApiError("Resume uploaded but text could not be read", 500);
    }
    return {
      text: synced.resumeText,
      truncated: synced.resumeText.length >= 8000,
      charCount: synced.charCount,
    };
  }

  const res = await fetch(`${apiBase(prefs)}/api/resume/parse`, {
    method: "POST",
    headers,
    body: form,
  });

  const body = await parseJson<{
    text?: string;
    truncated?: boolean;
    charCount?: number;
    error?: string;
  }>(res);

  if (!res.ok || !body.text) {
    throw new ApiError(body.error || "Could not parse resume", res.status);
  }

  return {
    text: body.text,
    truncated: body.truncated,
    charCount: body.charCount ?? body.text.length,
  };
}

/** Parse interviewer-shared PDF/DOCX/spec — does not save to profile resume. */
export async function parseInterviewDocument(
  prefs: Prefs,
  file: File,
): Promise<{ text: string; truncated?: boolean; filename: string; charCount: number }> {
  const headers: Record<string, string> = {};
  if (prefs.token) {
    headers.Authorization = `Bearer ${prefs.token}`;
  }

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${apiBase(prefs)}/api/ai/document/parse`, {
    method: "POST",
    headers,
    body: form,
  });

  const body = await parseJson<{
    text?: string;
    truncated?: boolean;
    filename?: string;
    charCount?: number;
    error?: string;
  }>(res);

  if (!res.ok || !body.text) {
    throw new ApiError(body.error || "Could not read document", res.status);
  }

  return {
    text: body.text,
    truncated: body.truncated,
    filename: body.filename || file.name,
    charCount: body.charCount ?? body.text.length,
  };
}

export async function fetchResume(prefs: Prefs): Promise<{
  resumeText: string;
  resumeFileName: string | null;
  hasResume: boolean;
  charCount: number;
}> {
  const headers: Record<string, string> = {};
  if (prefs.token) {
    headers.Authorization = `Bearer ${prefs.token}`;
  }

  const res = await fetch(`${apiBase(prefs)}/api/resume`, { headers });
  const body = await parseJson<{
    resumeText?: string;
    resumeFileName?: string | null;
    hasResume?: boolean;
    charCount?: number;
    error?: string;
  }>(res);

  if (!res.ok) {
    throw new ApiError(body.error || "Could not load resume", res.status);
  }

  return {
    resumeText: body.resumeText?.trim() || "",
    resumeFileName: body.resumeFileName ?? null,
    hasResume: Boolean(body.hasResume),
    charCount: body.charCount ?? (body.resumeText?.trim().length || 0),
  };
}

export async function saveResumeText(
  prefs: Prefs,
  text: string,
): Promise<{ resumeText: string; charCount: number }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (prefs.token) {
    headers.Authorization = `Bearer ${prefs.token}`;
  }

  const res = await fetch(`${apiBase(prefs)}/api/resume`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ text }),
  });

  const body = await parseJson<{
    resumeText?: string;
    charCount?: number;
    error?: string;
  }>(res);

  if (!res.ok) {
    throw new ApiError(body.error || "Could not save resume", res.status);
  }

  return {
    resumeText: body.resumeText?.trim() || "",
    charCount: body.charCount ?? (body.resumeText?.trim().length || 0),
  };
}

/** Sync one local day JSON file per DB row (logout / quit). */
export async function syncInterviewDays(
  prefs: Prefs,
  days: Array<{ date: string; question: string }>,
) {
  if (!days.length) {
    return { ok: true as const, saved: 0, dates: [] as string[] };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (prefs.token) {
    headers.Authorization = `Bearer ${prefs.token}`;
  }

  const res = await fetch(`${apiBase(prefs)}/api/questions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ days }),
  });

  const body = await parseJson<{
    ok?: boolean;
    saved?: number;
    dates?: string[];
    error?: string;
  }>(res);

  if (!res.ok) {
    throw new ApiError(body.error || "Could not sync interview questions", res.status);
  }

  return {
    ok: true as const,
    saved: body.saved ?? 0,
    dates: body.dates ?? [],
  };
}
