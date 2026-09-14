import OpenAI from "openai";
import { getAiConfig } from "@/lib/ai";

/**
 * File/chunk STT (our WASAPI peek/take path):
 *   gpt-transcribe — recommended, ~$0.0045/min, streams file deltas
 * Live continuous STT (needs Realtime WebSocket — not this module):
 *   gpt-live-transcribe — ~$0.017/min
 * Override with OPENAI_WHISPER_MODEL.
 */
const WHISPER_MODEL = process.env.OPENAI_WHISPER_MODEL || "gpt-transcribe";

/** Context only — new gpt-transcribe models reject task-style prompts. */
const TRANSCRIBE_CONTEXT =
  "Live job interview. Coding / DSA / system design discussion with programming terms.";

const INTERVIEW_KEYWORDS = [
  "O(n)",
  "API",
  "JSON",
  "kwargs",
  "args",
  "mutex",
  "semaphore",
  "LRU",
  "BFS",
  "DFS",
  "DP",
  "hashmap",
  "PostgreSQL",
  "Redis",
  "Kubernetes",
] as const;

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  const config = getAiConfig();
  if (config.demoMode) {
    throw new Error("OpenAI API key is not configured on the server");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl,
    });
  }
  return openaiClient;
}

const WHISPER_LANGUAGE_CODES: Record<string, string> = {
  english: "en",
  hindi: "hi",
  spanish: "es",
  french: "fr",
  german: "de",
  portuguese: "pt",
  italian: "it",
  japanese: "ja",
  korean: "ko",
  chinese: "zh",
  arabic: "ar",
  bengali: "bn",
  tamil: "ta",
  telugu: "te",
  marathi: "mr",
  gujarati: "gu",
  kannada: "kn",
  malayalam: "ml",
  punjabi: "pa",
  urdu: "ur",
  russian: "ru",
  dutch: "nl",
  turkish: "tr",
  vietnamese: "vi",
  indonesian: "id",
};

export function meetingLanguageToWhisperCode(language?: string): string | undefined {
  if (!language) return "en";
  const normalized = language.toLowerCase().replace(/\s*\(recommended\)\s*/g, "").trim();
  if (normalized.startsWith("auto")) return undefined;
  for (const [key, code] of Object.entries(WHISPER_LANGUAGE_CODES)) {
    if (normalized.startsWith(key)) return code;
  }
  return undefined;
}

/** gpt-transcribe / gpt-live-transcribe use `languages[]`; Whisper / 4o use `language`. */
function usesLanguagesArray(model: string) {
  return /^(gpt-transcribe|gpt-live-transcribe)/i.test(model.trim());
}

function supportsStreamingModel(model: string) {
  return /transcribe/i.test(model) && !/^whisper-1$/i.test(model);
}

function scrubPromptEcho(text: string) {
  const trimmed = text.trim();
  if (
    /\b(ignore filler words|no commentary|job interview\.?\s*transcribe|transcribe the interviewer'?s spoken question|live job interview\.?\s*coding)\b/i.test(
      trimmed,
    )
  ) {
    return "";
  }
  return trimmed;
}

function durationFromWav(bytes: Buffer, apiDuration?: number) {
  const sampleRate = 16000;
  const pcmBytes = Math.max(0, bytes.length - 44);
  return typeof apiDuration === "number" ? apiDuration : pcmBytes / (sampleRate * 2);
}

function buildCreateParams(
  file: File,
  language: string | undefined,
  stream: true,
): OpenAI.Audio.TranscriptionCreateParamsStreaming;
function buildCreateParams(
  file: File,
  language: string | undefined,
  stream: false,
): OpenAI.Audio.TranscriptionCreateParamsNonStreaming;
function buildCreateParams(
  file: File,
  language: string | undefined,
  stream: boolean,
): OpenAI.Audio.TranscriptionCreateParams {
  const code = meetingLanguageToWhisperCode(language);
  const model = WHISPER_MODEL;

  if (usesLanguagesArray(model)) {
    return {
      model,
      file,
      prompt: TRANSCRIBE_CONTEXT,
      keywords: [...INTERVIEW_KEYWORDS],
      ...(code ? { languages: [code] } : {}),
      stream: stream ? true : false,
    };
  }

  // Legacy whisper-1 / gpt-4o-*-transcribe
  return {
    model,
    file,
    ...(code ? { language: code } : {}),
    ...(code === "en" ? { prompt: TRANSCRIBE_CONTEXT } : {}),
    response_format: "json",
    temperature: 0,
    stream: stream ? true : false,
  };
}

export async function transcribeWavBuffer(
  bytes: Buffer,
  language?: string,
): Promise<{ text: string; durationSec: number }> {
  const config = getAiConfig();
  if (config.demoMode && process.env.AI_DEMO_MODE === "true") {
    return { text: "", durationSec: 0 };
  }

  if (bytes.length < 1000) {
    return { text: "", durationSec: 0 };
  }

  const client = getClient();
  const file = new File([Uint8Array.from(bytes)], "meeting.wav", {
    type: "audio/wav",
  });

  const result = await client.audio.transcriptions.create(
    buildCreateParams(file, language, false),
  );

  const text = scrubPromptEcho(result.text ?? "");
  const apiDuration = (result as { duration?: number }).duration;
  return { text, durationSec: durationFromWav(bytes, apiDuration) };
}

/**
 * Stream partial transcript text as soon as the model emits deltas.
 * Falls back to a single non-stream call when the model is whisper-1.
 */
export async function transcribeWavBufferStreaming(
  bytes: Buffer,
  language: string | undefined,
  onPartial: (text: string) => void,
): Promise<{ text: string; durationSec: number }> {
  const config = getAiConfig();
  if (config.demoMode && process.env.AI_DEMO_MODE === "true") {
    return { text: "", durationSec: 0 };
  }
  if (bytes.length < 1000) {
    return { text: "", durationSec: 0 };
  }

  if (!supportsStreamingModel(WHISPER_MODEL)) {
    const result = await transcribeWavBuffer(bytes, language);
    if (result.text) onPartial(result.text);
    return result;
  }

  const client = getClient();
  const file = new File([Uint8Array.from(bytes)], "meeting.wav", {
    type: "audio/wav",
  });

  const stream = await client.audio.transcriptions.create(
    buildCreateParams(file, language, true),
  );

  let text = "";
  for await (const event of stream) {
    const ev = event as {
      type?: string;
      delta?: string;
      text?: string;
    };
    if (ev.type === "transcript.text.delta" && typeof ev.delta === "string") {
      text += ev.delta;
      const cleaned = scrubPromptEcho(text);
      if (cleaned) onPartial(cleaned);
    } else if (ev.type === "transcript.text.done" && typeof ev.text === "string") {
      text = ev.text;
    } else if (typeof ev.delta === "string") {
      text += ev.delta;
      const cleaned = scrubPromptEcho(text);
      if (cleaned) onPartial(cleaned);
    } else if (typeof ev.text === "string" && ev.text.trim()) {
      text = ev.text;
    }
  }

  text = scrubPromptEcho(text);
  if (text) onPartial(text);
  return { text, durationSec: durationFromWav(bytes) };
}

export async function transcribeWavBase64(
  audioBase64: string,
  language?: string,
): Promise<{ text: string; durationSec: number }> {
  return transcribeWavBuffer(Buffer.from(audioBase64, "base64"), language);
}
