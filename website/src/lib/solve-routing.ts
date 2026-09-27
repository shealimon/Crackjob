import type { InterviewModeId } from "@/lib/constants";
import { questionNeedsResume } from "@/lib/prompts";

export type SolveSource = "voice" | "screenshot" | "text";

export type StreamModelConfig = {
  model: string;
  fastModel: string;
  nanoModel: string;
};

export type SolveRoutingInput = {
  mode?: InterviewModeId | string;
  source?: SolveSource;
  imageBase64?: string;
  questionText?: string;
  conversationContext?: string;
  extraContext?: string;
  interactiveHandsOn?: boolean;
};

export function looksLikeDesignQuestion(question: string, mode?: string) {
  if (mode === "system_design" || mode === "lld") return true;
  return /\b(design|architect|system design|hld|lld|low[- ]level design|high[- ]level|url shortener|parking lot|rate limiter|news feed|chat (?:app|system)|elevator|bookmyshow|uber|instagram|youtube|whatsapp|capacity|data model|class diagram|object design)\b/i.test(
    question,
  );
}

/**
 * Quality path: screenshot, voice+screenshot, pasted text.
 * Speed path: spoken audio with no image (Ctrl+Enter voice).
 */
export function isQualitySolvePath(options: SolveRoutingInput): boolean {
  if (options.source === "voice" && !options.imageBase64) return false;
  if (options.imageBase64) return true;
  if (options.source === "screenshot") return true;
  if (options.source === "text") return true;
  // Clients that omit source: pasted/typed text stay on the quality model.
  return Boolean(options.questionText?.trim());
}

/**
 * Nano is reserved for tiny spoken follow-ups ("why?", "next?", "time complexity?").
 * Never used when a screenshot is attached.
 */
export function isTrivialVoiceFollowUp(options: SolveRoutingInput): boolean {
  if (options.imageBase64) return false;
  if (options.source !== "voice") return false;
  if (!options.conversationContext?.trim()) return false;
  const q = options.questionText?.trim() || "";
  if (!q) return false;
  if (q.length > 80) return false;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 8) return false;
  if (words.length <= 4) return true;
  return /^(why|ok|okay|next|continue|go on|and then|what(?:'s| is)? next|time complexity|space complexity|big o|edge cases?|can you (?:repeat|summarize)|repeat|summarize)\b/i.test(
    q,
  );
}

export function pickStreamModel(
  options: SolveRoutingInput,
  config: StreamModelConfig,
): string {
  // Spoken audio (no screenshot): nano TTFT path. Luna made Ctrl+Enter 5–7s first hit.
  if (options.source === "voice" && !options.imageBase64) {
    return config.nanoModel || config.fastModel;
  }
  if (isTrivialVoiceFollowUp(options)) {
    return config.nanoModel || config.fastModel;
  }
  if (isQualitySolvePath(options)) {
    return config.model;
  }
  return config.fastModel;
}

export function getMaxOutputTokens() {
  const parsed = Number(process.env.OPENAI_MAX_TOKENS ?? "2400");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 2400;
}

/** Screenshot / text / fused answers — room for coding + design. */
export function getQualityAnswerMaxTokens() {
  const parsed = Number(process.env.OPENAI_SCREENSHOT_MAX_TOKENS ?? "1600");
  if (!Number.isFinite(parsed) || parsed <= 0) return 1600;
  const ceiling = Math.max(getMaxOutputTokens(), 1600);
  return Math.min(Math.max(Math.floor(parsed), 1200), ceiling);
}

/** Voice-only speed path — enough for a spoken answer without a 500-token clip. */
export function getVoiceAnswerMaxTokens() {
  const parsed = Number(process.env.OPENAI_VOICE_MAX_TOKENS ?? "1200");
  if (!Number.isFinite(parsed) || parsed <= 0) return 1200;
  return Math.min(Math.max(Math.floor(parsed), 600), getMaxOutputTokens());
}

export function getAnswerMaxTokens(options: SolveRoutingInput, question: string) {
  const design = looksLikeDesignQuestion(question, options.mode);
  if (options.interactiveHandsOn) {
    const base = getMaxOutputTokens();
    if (design) return Math.max(base, 2800);
    return Math.max(base, getQualityAnswerMaxTokens());
  }

  if (isQualitySolvePath(options)) {
    const base = getQualityAnswerMaxTokens();
    if (design) return Math.max(base, 2800);
    const needsResume =
      Boolean(question.trim()) && questionNeedsResume(question);
    if (needsResume) return Math.max(base, getMaxOutputTokens());
    return base;
  }

  const voice = getVoiceAnswerMaxTokens();
  return design ? Math.max(voice, 1600) : voice;
}

/** Screenshot answers — high detail so statement body / code stays readable. */
export function getAnswerImageDetail(): "low" | "high" | "auto" {
  const env = process.env.OPENAI_IMAGE_DETAIL?.trim().toLowerCase();
  if (env === "high" || env === "auto" || env === "low") return env;
  return "high";
}
