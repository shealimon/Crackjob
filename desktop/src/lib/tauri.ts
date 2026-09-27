import { invoke } from "@tauri-apps/api/core";
import {
  CODE_LANGUAGE_ALIASES,
  CODE_LANGUAGES,
  DEFAULT_API_URL,
  MEETING_AUDIO_LANGUAGE_ALIASES,
  MEETING_AUDIO_LANGUAGES,
  OUTPUT_LANGUAGE_ALIASES,
  OUTPUT_LANGUAGES,
} from "./constants";
import type { AudioChunk, AudioStatus, Prefs, StealthStatus } from "./types";
import type { InterviewModeId } from "./constants";

function normalizeMeetingAudioLanguage(value?: string | null) {
  if (!value) return "English (recommended)";
  if ((MEETING_AUDIO_LANGUAGES as readonly string[]).includes(value)) return value;
  return MEETING_AUDIO_LANGUAGE_ALIASES[value] ?? value;
}

function normalizeOutputLanguage(value?: string | null) {
  if (!value) return "English";
  if ((OUTPUT_LANGUAGES as readonly string[]).includes(value)) return value;
  return OUTPUT_LANGUAGE_ALIASES[value] ?? value;
}

function normalizeCodeLanguage(value?: string | null) {
  if (!value) return "Python";
  if ((CODE_LANGUAGES as readonly string[]).includes(value)) return value;
  return CODE_LANGUAGE_ALIASES[value] ?? value;
}

function resolveApiUrl(saved?: string | null) {
  let url = (saved || "").replace(/\/$/, "");
  // www → apex; POST across a 308 redirect breaks WebView fetch.
  if (/^https?:\/\/www\.crackjob\.co$/i.test(url)) {
    url = "https://crackjob.co";
  }
  // Release EXE: never keep a stale localhost prefs URL from older installs.
  if (import.meta.env.PROD && (!url || /localhost|127\.0\.0\.1/i.test(url))) {
    return DEFAULT_API_URL;
  }
  return url || DEFAULT_API_URL;
}

/** Always emit concrete remember-* fields so IPC/serde never drops them as undefined. */
export function normalizePrefs(prefs: Prefs): Prefs {
  const rememberMe = Boolean(prefs.rememberMe);
  return {
    apiUrl: resolveApiUrl(prefs.apiUrl),
    token: prefs.token ?? null,
    deviceId: prefs.deviceId,
    mode: (prefs.mode as InterviewModeId) || "dsa",
    companyPack: prefs.companyPack || "",
    outputLanguage: normalizeOutputLanguage(prefs.outputLanguage),
    codeLanguage: normalizeCodeLanguage(prefs.codeLanguage),
    meetingAudioLanguage: normalizeMeetingAudioLanguage(prefs.meetingAudioLanguage),
    overlayOpacity: prefs.overlayOpacity ?? 0.75,
    clickThrough: true,
    resumeText: prefs.resumeText || "",
    rememberMe,
    rememberedEmail: rememberMe ? prefs.rememberedEmail || "" : "",
    rememberedPassword: rememberMe ? prefs.rememberedPassword || "" : "",
  };
}

export async function loadPrefs(): Promise<Prefs> {
  const prefs = await invoke<Prefs>("load_prefs");
  return normalizePrefs(prefs);
}

export async function savePrefs(prefs: Prefs) {
  const normalized = normalizePrefs(prefs);
  const saved = await invoke<Prefs>("save_prefs", { prefs: normalized });
  return normalizePrefs(saved);
}

export async function captureScreenshot() {
  return invoke<{ imageBase64: string; mimeType: string }>("capture_screenshot");
}

/** Overlay / in-app Ctrl+H — same events as global hotkey (main window owns the slot). */
export async function captureInterviewHotkey() {
  return invoke<{ imageBase64: string; mimeType: string }>("capture_interview_hotkey");
}

export async function showOverlay() {
  return invoke<void>("show_overlay");
}

export async function hideOverlay() {
  return invoke<void>("hide_overlay");
}

export async function toggleOverlay() {
  return invoke<boolean>("toggle_overlay");
}

export async function setClickThrough(enabled: boolean) {
  return invoke<boolean>("set_click_through", { enabled });
}

export async function getStealthStatus() {
  return invoke<StealthStatus>("get_stealth_status");
}

export async function readAudioStatus() {
  return invoke<AudioStatus>("audio_status");
}

export async function startSystemAudio() {
  return invoke<AudioStatus>("start_system_audio");
}

export async function stopSystemAudio() {
  return invoke<AudioStatus>("stop_system_audio");
}

export async function takeAudioChunk(minMs = 2500) {
  return invoke<AudioChunk | null>("take_audio_chunk", { minMs });
}

export async function peekAudioChunk(minMs = 500) {
  return invoke<AudioChunk | null>("peek_audio_chunk", { minMs });
}

/** Mid-speech peek — no silence wait (live Q text while interviewer still talking). */
export async function peekProgressAudioChunk(minMs = 1000) {
  return invoke<AudioChunk | null>("peek_progress_audio_chunk", { minMs });
}

/** Take speech now — skip silence-end wait (Ctrl+Enter before STT text appears). */
export async function forceTakeAudioChunk(minMs = 200) {
  return invoke<AudioChunk | null>("force_take_audio_chunk", { minMs });
}

export async function discardAudioChunk(minMs = 2500) {
  return invoke<void>("discard_audio_chunk", { minMs });
}

export async function setToolbarWindowExpanded(
  expanded: boolean,
  width?: number,
  center?: boolean,
) {
  return invoke<void>("set_toolbar_window_expanded", {
    expanded,
    width: width && width > 0 ? width : null,
    center: typeof center === "boolean" ? center : null,
  });
}

export async function setOverlayLayout(compact: boolean, height?: number) {
  return invoke<void>("set_overlay_layout", {
    compact,
    height: height && height > 0 ? height : null,
  });
}

export async function setInterviewActive(active: boolean) {
  return invoke<void>("set_interview_active", { active });
}

export async function isInterviewActive() {
  return invoke<boolean>("is_interview_active");
}

/** Drop Rust last_capture — must stay in sync with JS activeScreenshot invalidation. */
export async function clearStoredCapture() {
  return invoke<void>("clear_stored_capture");
}

export async function requestSolve() {
  return invoke<void>("request_solve");
}

export async function moveAppWindows(dx: number, dy: number) {
  return invoke<void>("move_app_windows", { dx, dy });
}

export async function quitApp() {
  return invoke<void>("quit_app");
}
