import OpenAI from "openai";
import { getAiConfig } from "@/lib/ai";

// whisper-1 is typically faster for short utterances; override with OPENAI_WHISPER_MODEL if needed.
const WHISPER_MODEL = process.env.OPENAI_WHISPER_MODEL || "whisper-1";
const TRANSCRIBE_PROMPT =
  "Job interview. Transcribe the interviewer's spoken question exactly. Keep programming tokens as spoken or conventional spellings (args, kwargs, *args, **kwargs, O(n), API, JSON). Fix obvious speech-to-text errors. Ignore filler words like uh, um. No commentary.";
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
  const whisperLanguage = meetingLanguageToWhisperCode(language);

  const result = await client.audio.transcriptions.create({
    model: WHISPER_MODEL,
    file,
    language: whisperLanguage,
    ...(whisperLanguage === "en" ? { prompt: TRANSCRIBE_PROMPT } : {}),
    response_format: "json",
    // Prefer speed over verbose timestamps for short interview clips.
    temperature: 0,
  });

  const text = (result.text ?? "").trim();
  const sampleRate = 16000;
  const pcmBytes = Math.max(0, bytes.length - 44);
  const apiDuration = (result as { duration?: number }).duration;
  const durationSec =
    typeof apiDuration === "number" ? apiDuration : pcmBytes / (sampleRate * 2);

  // Whisper sometimes echoes its own prompt on short/noisy clips.
  if (
    /\b(ignore filler words|no commentary|job interview\.?\s*transcribe|transcribe the interviewer'?s spoken question)\b/i.test(
      text,
    )
  ) {
    return { text: "", durationSec };
  }

  return { text, durationSec };
}

export async function transcribeWavBase64(
  audioBase64: string,
  language?: string,
): Promise<{ text: string; durationSec: number }> {
  return transcribeWavBuffer(Buffer.from(audioBase64, "base64"), language);
}
