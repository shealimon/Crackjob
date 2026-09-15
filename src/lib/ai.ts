import OpenAI from "openai";
import type { InterviewModeId } from "@/lib/constants";
import { prepareVisionImage } from "@/lib/image";
import {
  buildScreenshotStreamPrompt,
  buildStreamPrompt,
  formatResumeContext,
  normalizeExtractedQuestion,
  questionNeedsResume,
  streamTextToResult,
  type SolveResult,
} from "@/lib/prompts";
import { analyzeResumeExperience } from "@/lib/resume-experience";

type UserContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export type SolveOptions = {
  mode: InterviewModeId;
  imageBase64?: string;
  mimeType?: string;
  questionText?: string;
  extraContext?: string;
  conversationContext?: string;
  companyPack?: string;
  outputLanguage?: string;
  codeLanguage?: string;
};

export type StreamSolveEvent =
  | { type: "delta"; text: string; result: SolveResult }
  | {
      type: "done";
      text: string;
      result: SolveResult;
      inputTokens: number;
      outputTokens: number;
      demo: boolean;
      model: string;
    };

export type AiConfig = {
  configured: boolean;
  demoMode: boolean;
  model: string;
  fastModel: string;
  visionModel: string;
  baseUrl: string;
};

let openaiClient: OpenAI | null = null;

export function getAiConfig(): AiConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const demoMode = !apiKey;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  return {
    configured: Boolean(apiKey),
    demoMode,
    model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
    // Voice/live TTFT path — nano is cheapest+fast among 4.1; override via OPENAI_FAST_MODEL.
    fastModel: process.env.OPENAI_FAST_MODEL || "gpt-4.1-nano",
    visionModel: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
    baseUrl,
  };
}

function getOpenAiClient(): OpenAI {
  const config = getAiConfig();
  if (config.demoMode) {
    throw new Error("OpenAI API key is not configured");
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl,
    });
  }

  return openaiClient;
}

function useCheapTwoStep() {
  const flag = process.env.OPENAI_CHEAP_MODE?.trim().toLowerCase();
  // Default on — two-step avoids sending image + long prompt in one expensive call.
  return flag !== "false";
}

/** Vision extract (fallback) — prefer high so statement body isn't missed. */
function getExtractImageDetail(): "low" | "high" | "auto" {
  const env =
    process.env.OPENAI_EXTRACT_IMAGE_DETAIL?.trim().toLowerCase() ||
    process.env.OPENAI_IMAGE_DETAIL?.trim().toLowerCase();
  if (env === "high" || env === "auto" || env === "low") return env;
  return "high";
}

/** Live screenshot→answer stream — low detail cuts TTFT on ≤768 captures. */
function getAnswerImageDetail(): "low" | "high" | "auto" {
  const env = process.env.OPENAI_IMAGE_DETAIL?.trim().toLowerCase();
  if (env === "high" || env === "auto" || env === "low") return env;
  return "low";
}

function getMaxOutputTokens() {
  // Design answers need full HLD/LLD sections; coding needs approach + fences.
  const parsed = Number(process.env.OPENAI_MAX_TOKENS ?? "2400");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 2400;
}

/** Screenshot answers — keep cap modest so first tokens arrive faster. */
function getScreenshotAnswerMaxTokens() {
  const parsed = Number(process.env.OPENAI_SCREENSHOT_MAX_TOKENS ?? "500");
  if (!Number.isFinite(parsed) || parsed <= 0) return 500;
  return Math.min(Math.max(Math.floor(parsed), 300), getMaxOutputTokens());
}

function looksLikeDesignQuestion(question: string, mode?: string) {
  if (mode === "system_design" || mode === "lld") return true;
  return /\b(design|architect|system design|hld|lld|low[- ]level design|high[- ]level|url shortener|parking lot|rate limiter|news feed|chat (?:app|system)|elevator|bookmyshow|uber|instagram|youtube|whatsapp|capacity|data model|class diagram|object design)\b/i.test(
    question,
  );
}

function getAnswerMaxTokens(options: SolveOptions, question: string) {
  const isShot = Boolean(options.imageBase64) && !options.questionText?.trim();
  const base = isShot ? getScreenshotAnswerMaxTokens() : getMaxOutputTokens();
  // Screenshot keeps the configured cap — HLD/LLD mode used to bump to 2800 and
  // delay first tokens by seconds even for simple on-screen asks.
  if (!isShot && looksLikeDesignQuestion(question, options.mode)) {
    return Math.max(base, 2800);
  }
  return base;
}

function getVisionMaxTokens() {
  // Need room for a real problem statement, not just a title.
  const parsed = Number(process.env.OPENAI_VISION_MAX_TOKENS ?? "450");
  if (!Number.isFinite(parsed) || parsed <= 0) return 450;
  return Math.max(Math.floor(parsed), 200);
}

/** GPT-5.x rejects `max_tokens`; use `max_completion_tokens` instead. */
function isGpt5Family(model: string) {
  return /^gpt-5/i.test(model.trim());
}

function completionOutputParams(model: string, maxTokens: number) {
  if (isGpt5Family(model)) {
    return { max_completion_tokens: maxTokens };
  }
  return { max_tokens: maxTokens };
}

/**
 * GPT-5.x only accepts the default temperature (1). Sending 0 / 0.2 → 400:
 * "temperature does not support X with this model, only the default (1)".
 */
function temperatureParams(model: string, temperature: number) {
  if (isGpt5Family(model)) return {};
  return { temperature };
}

/** Live interview: medium for design depth; low otherwise (latency). */
function gpt5LiveParams(model: string, options?: { design?: boolean }) {
  if (!isGpt5Family(model)) return {};
  const envEffort = process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  const fallback = options?.design ? "medium" : "low";
  const effort = (envEffort || fallback) as "none" | "low" | "medium" | "high";
  if (effort === "none" || effort === "low" || effort === "medium" || effort === "high") {
    return { reasoning_effort: effort };
  }
  return { reasoning_effort: fallback as "low" | "medium" };
}

const EXTRACT_QUESTION_SYSTEM = `You read screenshots for a live interview copilot. Extract the ONE question the candidate must answer from the BACKGROUND page.

Sources (any of these — pick the real ask):
- Coding platforms (LeetCode, HackerRank, CodeSignal, Codeforces, GFG, OA portals, IDE): problem title PLUS the problem statement (Given…, Return…, key constraints). Include enough detail to solve — not the title alone.
- Plain text / docs / Notion / Google Doc / PDF / interview question list: the exact question wording on screen.
- Chat / Slack / Teams / Zoom / Meet chat or shared notes: the interviewer's latest question text.
- Search bar / typed prompt: the exact typed query (ignore result-page SEO snippets below).
- Whiteboard / slide with a written question: that text.

CRITICAL — do NOT:
- Return only the first heading, tab title, nav label, difficulty (Easy/Medium/Hard), company name, or "Description" chrome.
- Invent "What is the X problem?" — restate the actual task instead.
- Copy Crack overlay / AI Response / Transcripts / prior answers sitting on top of the page.
- Answer the question — extract only.

Output format (exactly):
SHORT: <≤12 words — UI label, e.g. problem name or first clause of a theory ask>
FULL: <complete question the candidate must answer; 2–8 sentences max; keep inputs/outputs/constraints for coding; quote plain-text questions verbatim when short>`;

const SCREENSHOT_INSTRUCTION =
  `Answer the on-screen interview question (editor/IDE/doc/coding site). Ignore Crack UI/overlay and login chrome. Never say you cannot view images. No preamble.`;

function pickStreamModel(options: SolveOptions, config: AiConfig) {
  // Speed-first: voice AND screenshot answers use fastModel (nano).
  // visionModel only for extract fallback — mini was ~1–3s TTFT on shots.
  return config.fastModel || (options.imageBase64 ? config.visionModel : config.model);
}

async function buildStreamUserContent(
  options: SolveOptions,
): Promise<string | UserContent[]> {
  if (options.questionText?.trim() && !options.imageBase64) {
    return buildAnswerUserText(options, options.questionText.trim());
  }

  if (options.imageBase64) {
    // Primary screenshot path: single vision call streams the candidate answer.
    // Do NOT attach resume here — 8k resume tokens wreck vision TTFT; coding screenshots
    // are the common case. Voice/HR still gets resume via the text path.
    const prepared = await prepareVisionImage(options.imageBase64, options.mimeType);
    const parts: string[] = [];
    if (options.conversationContext?.trim()) {
      parts.push(
        `${options.conversationContext.trim()}\n\nThis is a follow-up on the prior Q&A above. Answer ONLY the new on-screen question — do not re-solve the previous problem.`,
      );
    }
    parts.push(SCREENSHOT_INSTRUCTION);

    return [
      { type: "text", text: parts.join("\n\n") },
      {
        type: "image_url",
        image_url: {
          url: prepared.dataUrl,
          detail: getAnswerImageDetail(),
        },
      },
    ];
  }

  throw new Error("Send a screenshot or paste the question text");
}

function isBadExtractedQuestion(question: string) {
  const q = question.trim();
  if (!q || q.length < 8) return true;
  return /unable to (view|see|interpret|assist)|cannot (view|see|interpret)|i('m| am) unable|i see no (question|problem)|no question (on|in) (this |the )?(screen|image)|nothing (on|in) (this |the )?screen|on[- ]screen question|screenshot question|what( is|'s) the question on this screen/i.test(
    q,
  );
}

/** Title-only / too thin — answer model needs the real statement from the image. */
function isTitleOnlyExtract(question: string) {
  const q = question.trim();
  if (!q) return true;
  // Definition framing with no statement — need the screenshot body.
  if (/^what is (?:the )?[\w\s.+#/-]+\s+problem\??$/i.test(q)) return true;
  if (/^(?:\d+\.\s*)?(?:solve\s+)?[\w\s.+#/-]{2,60}$/i.test(q) && q.length < 80) {
    if (!/\b(given|return|write|implement|find|compute|constraint|example|input|output)\b/i.test(q)) {
      return true;
    }
  }
  if (q.length >= 100) return false;
  const words = q.split(/\s+/).filter(Boolean);
  // Short label without punctuation — usually a heading, not the ask.
  if (words.length <= 8 && !/[?!.]/.test(q)) return true;
  return false;
}

function parseVisionExtract(raw: string): { shortLabel: string; question: string } {
  const text = raw.trim();
  if (!text) return { shortLabel: "", question: "" };

  const shortMatch = text.match(/^\s*SHORT:\s*(.+?)(?:\n|$)/im);
  const fullMatch = text.match(/\bFULL:\s*([\s\S]+)$/i);
  if (fullMatch) {
    const question = fullMatch[1].trim().replace(/\s+/g, " ");
    const shortLabel =
      shortMatch?.[1]?.trim().replace(/\s+/g, " ") ||
      question.split(/(?<=[.!?])\s+|:\s+/)[0]?.slice(0, 80) ||
      question.slice(0, 80);
    return { shortLabel, question };
  }

  const cleaned = text.replace(/^(?:SHORT|FULL):\s*/gim, "").replace(/\s+/g, " ").trim();
  return {
    shortLabel: cleaned.slice(0, 80),
    question: cleaned,
  };
}

async function extractQuestionFromImage(
  options: SolveOptions,
): Promise<{ question: string; shortLabel: string; inputTokens: number; outputTokens: number }> {
  if (!options.imageBase64) {
    return { question: "", shortLabel: "", inputTokens: 0, outputTokens: 0 };
  }

  const config = getAiConfig();
  const client = getOpenAiClient();
  const prepared = await prepareVisionImage(options.imageBase64, options.mimeType);
  const completion = await client.chat.completions.create({
    model: config.visionModel,
    ...temperatureParams(config.visionModel, 0),
    ...completionOutputParams(config.visionModel, getVisionMaxTokens()),
    ...gpt5LiveParams(config.visionModel),
    messages: [
      { role: "system", content: EXTRACT_QUESTION_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract the on-screen interview question behind any overlay. Use SHORT + FULL. For coding platforms include the problem statement, not just the title. For plain text, quote the question.",
          },
          {
            type: "image_url",
            image_url: { url: prepared.dataUrl, detail: getExtractImageDetail() },
          },
        ],
      },
    ],
  });

  const parsed = parseVisionExtract(completion.choices[0]?.message?.content?.trim() || "");
  return {
    question: parsed.question,
    shortLabel: parsed.shortLabel,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
}

function buildAnswerUserText(options: SolveOptions, question: string) {
  const parts: string[] = [];
  const resumeText = options.extraContext?.trim() || "";
  const needsResume = Boolean(resumeText) && questionNeedsResume(question);

  if (options.conversationContext?.trim()) {
    parts.push(
      `${options.conversationContext.trim()}

FOLLOW-UP RULES for the new question below:
- The interviewer may ask ANYTHING next (code, example, why, trade-offs, use cases, edge case, another approach, deeper detail, "what if", etc.).
- Answer ONLY that latest ask. Use the prior Q&A as context for the same thread — do not restart or repeat the full previous answer.
- Stay on the MOST RECENT prior topic. Never pull in or re-paste an older unrelated problem's solution.
- If the new ask is clearly a different topic, ignore the prior Q&A and answer it on its own.
- Sound like a real candidate — natural, first-person, and concise.`,
    );
  }

  if (needsResume) {
    const summary = analyzeResumeExperience(resumeText);
    const yearsRule = summary.shouldMentionYears && summary.yearsLabel
      ? `Total experience across ALL companies in the resume is ${summary.yearsLabel} — use that if mentioning years, never a smaller guess like 5 years.`
      : "Do NOT state a total years-of-experience number unless the resume/profile clearly supports it — describe the candidate's career across the companies and roles listed instead.";
    parts.push(
      `IMPORTANT: This is an HR / resume / behavioral question. Answer ONLY from the resume and profile context below. ${yearsRule} Mention real company names, titles, projects, and technologies from that context — never invent a generic "tech company", degree, tenure, salary figure, or notice period. If salary, notice, or joining date are missing, say you are open to discuss / flexible in one short sentence — do not fabricate numbers.`,
    );
  }

  parts.push(`Question:\n${question}`);

  if (needsResume) {
    const resumeBlock = formatResumeContext(resumeText);
    if (resumeBlock) {
      parts.push(resumeBlock);
    }
  }
  return parts.join("\n\n");
}

function streamPromptOptions(options: SolveOptions) {
  const resumeText = options.extraContext?.trim() || "";
  return {
    companyPack: options.companyPack,
    outputLanguage: options.outputLanguage,
    codeLanguage: options.codeLanguage,
    hasResume: Boolean(resumeText),
  };
}

function answerTemperature(options: SolveOptions, question: string) {
  const resumeText = options.extraContext?.trim() || "";
  if (resumeText && questionNeedsResume(question)) return 0;
  if (resumeText) return 0.1;
  return 0.2;
}

async function* streamCheapTwoStep(options: SolveOptions): AsyncGenerator<StreamSolveEvent> {
  const fromText = Boolean(options.questionText?.trim());
  const extractedRaw = fromText
    ? {
        question: options.questionText!.trim(),
        shortLabel: options.questionText!.trim().slice(0, 80),
        inputTokens: 0,
        outputTokens: 0,
      }
    : await extractQuestionFromImage(options);

  const fullQuestion = normalizeExtractedQuestion(extractedRaw.question);
  const shortLabel = normalizeExtractedQuestion(
    extractedRaw.shortLabel || fullQuestion.slice(0, 80),
  );
  const displayLabel = shortLabel || fullQuestion;

  if (
    options.imageBase64 &&
    !fromText &&
    (isBadExtractedQuestion(fullQuestion) || isTitleOnlyExtract(fullQuestion))
  ) {
    // Title-only / failed extract → answer from the screenshot directly.
    yield* streamFastSingleCall(options);
    return;
  }

  const prompt = buildStreamPrompt(options.mode, streamPromptOptions(options));
  const client = getOpenAiClient();
  const config = getAiConfig();
  const design = looksLikeDesignQuestion(fullQuestion, options.mode);
  const maxOut = getAnswerMaxTokens(options, fullQuestion);
  const model = pickStreamModel(options, config);

  const emptyResult = streamTextToResult("", displayLabel);
  yield { type: "delta", text: "", result: emptyResult };

  const completion = await client.chat.completions.create({
    model,
    ...temperatureParams(model, answerTemperature(options, fullQuestion)),
    ...completionOutputParams(model, maxOut),
    ...gpt5LiveParams(model, { design }),
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: buildAnswerUserText(options, fullQuestion) },
    ],
  });

  let text = "";
  let answerInput = 0;
  let answerOutput = 0;

  for await (const chunk of completion) {
    if (chunk.usage) {
      answerInput = chunk.usage.prompt_tokens ?? answerInput;
      answerOutput = chunk.usage.completion_tokens ?? answerOutput;
    }
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (!delta) continue;
    text += delta;
    yield { type: "delta", text, result: streamTextToResult(text, displayLabel) };
  }

  if (!text.trim()) {
    throw new Error("AI provider returned an empty answer");
  }

  yield {
    type: "done",
    text,
    result: streamTextToResult(text, displayLabel),
    inputTokens: extractedRaw.inputTokens + answerInput,
    outputTokens: extractedRaw.outputTokens + answerOutput,
    demo: false,
    model,
  };
}

async function* streamFastSingleCall(options: SolveOptions): AsyncGenerator<StreamSolveEvent> {
  const t0 = Date.now();
  const config = getAiConfig();
  const isShot = Boolean(options.imageBase64) && !options.questionText?.trim();
  // Screenshot: lean vision prompt (full smart prompt was ~2–3s TTFT tax).
  // Audio / pasted text: full quality prompt.
  const prompt = isShot
    ? buildScreenshotStreamPrompt({
        codeLanguage: options.codeLanguage,
        companyPack: options.companyPack,
        outputLanguage: options.outputLanguage,
        mode: options.mode,
      })
    : buildStreamPrompt(options.mode, streamPromptOptions(options));
  const userContent = await buildStreamUserContent(options);
  const tPrep = Date.now();
  const client = getOpenAiClient();
  const question = options.questionText?.trim() || "";
  const model = pickStreamModel(options, config);
  const design = looksLikeDesignQuestion(question, options.mode);
  const maxOut = getAnswerMaxTokens(options, question);
  const completion = await client.chat.completions.create({
    model,
    ...temperatureParams(
      model,
      isShot ? 0.2 : answerTemperature(options, question),
    ),
    ...completionOutputParams(model, maxOut),
    ...gpt5LiveParams(model, { design }),
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: userContent },
    ],
  });

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let firstTokenAt = 0;

  for await (const chunk of completion) {
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
      outputTokens = chunk.usage.completion_tokens ?? outputTokens;
    }
    const delta = chunk.choices[0]?.delta?.content ?? "";
    if (!delta) continue;
    if (!firstTokenAt) {
      firstTokenAt = Date.now();
      console.info(
        `[solve] ttft=${firstTokenAt - t0}ms prep=${tPrep - t0}ms model=${model} shot=${isShot} maxOut=${maxOut}`,
      );
    }
    text += delta;
    yield { type: "delta", text, result: streamTextToResult(text) };
  }

  if (!text.trim()) {
    throw new Error("AI provider returned an empty answer");
  }

  yield {
    type: "done",
    text,
    result: streamTextToResult(text),
    inputTokens,
    outputTokens,
    demo: false,
    model,
  };
}

export async function* streamSolve(options: SolveOptions): AsyncGenerator<StreamSolveEvent> {
  const config = getAiConfig();
  if (config.demoMode) {
    throw new Error("OpenAI API key is not configured on the server");
  }

  const hasImage = Boolean(options.imageBase64);
  const hasText = Boolean(options.questionText?.trim());

  // Screenshot-only: one vision stream (skip extract→answer). Extract was adding
  // a full blocked round-trip before any tokens hit the overlay.
  if (hasImage && !hasText) {
    yield* streamFastSingleCall(options);
    return;
  }

  // Spoken / pasted text: one fast stream (fastModel). Previously used
  // streamCheapTwoStep → OPENAI_MODEL (gpt-5.x) which added ~2s TTFT after Ctrl+Enter.
  if (hasText) {
    yield* streamFastSingleCall(options);
    return;
  }

  if (useCheapTwoStep()) {
    yield* streamCheapTwoStep(options);
    return;
  }

  yield* streamFastSingleCall(options);
}

export async function runSolve(
  options: SolveOptions,
): Promise<{ result: SolveResult; inputTokens: number; outputTokens: number; demo: boolean }> {
  if (!options.imageBase64 && !options.questionText?.trim()) {
    throw new Error("Send a screenshot or paste the question text");
  }

  const config = getAiConfig();
  if (config.demoMode) {
    throw new Error("OpenAI API key is not configured on the server");
  }

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let result: SolveResult | null = null;

  for await (const event of streamSolve(options)) {
    if (event.type === "delta") {
      text = event.text;
      result = event.result;
    } else {
      text = event.text;
      result = event.result;
      inputTokens = event.inputTokens;
      outputTokens = event.outputTokens;
    }
  }

  if (!result) {
    throw new Error("AI provider returned an empty answer");
  }

  return { result, inputTokens, outputTokens, demo: false };
}

export function tokensToCredits(inputTokens: number, outputTokens: number) {
  return Math.max(1, inputTokens + outputTokens);
}

export type { SolveResult };
