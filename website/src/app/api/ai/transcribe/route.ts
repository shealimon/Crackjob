import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, optionsCors } from "@/lib/http";
import {
  estimateBase64DecodedBytes,
  MAX_AUDIO_BYTES,
} from "@/lib/request-limits";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { mapOpenAiError } from "@/lib/openai-errors";
import { transcribeWavBuffer, transcribeWavBase64, transcribeWavBufferStreaming } from "@/lib/transcribe";

const jsonSchema = z.object({
  audioBase64: z
    .string()
    .min(100)
    .max(18_000_000)
    .refine(
      (value) => estimateBase64DecodedBytes(value) <= MAX_AUDIO_BYTES,
      { message: "Audio is too large" },
    ),
  language: z.string().max(40).optional(),
  stream: z.boolean().optional(),
});

export function OPTIONS() {
  return optionsCors();
}

function sseEncode(obj: unknown) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const limited = checkRateLimit(`ai:transcribe:${authed.userId}`, {
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfterSec);
  }

  const t0 = Date.now();
  try {
    const contentType = request.headers.get("content-type") || "";
    let language: string | undefined;
    let wantStream = false;
    let buffer: Buffer | null = null;
    let audioBase64: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("audio");
      language =
        typeof form.get("language") === "string" ? String(form.get("language")) : undefined;
      wantStream =
        String(form.get("stream") || "") === "1" ||
        String(form.get("stream") || "").toLowerCase() === "true";
      if (!(file instanceof Blob) || file.size < 1000) {
        return json({ error: "Send audio file (WAV)" }, { status: 400 });
      }
      if (file.size > MAX_AUDIO_BYTES) {
        return json({ error: "Audio file is too large" }, { status: 413 });
      }
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const body = jsonSchema.safeParse(await request.json().catch(() => null));
      if (!body.success) {
        return json({ error: "Send audioBase64 (WAV) or multipart audio" }, { status: 400 });
      }
      audioBase64 = body.data.audioBase64;
      language = body.data.language;
      wantStream = Boolean(body.data.stream);
      buffer = Buffer.from(audioBase64, "base64");
    }

    if (buffer && buffer.length > MAX_AUDIO_BYTES) {
      return json({ error: "Audio file is too large" }, { status: 413 });
    }

    if (wantStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            const { text, durationSec } = await transcribeWavBufferStreaming(
              buffer!,
              language,
              (partial) => {
                controller.enqueue(encoder.encode(sseEncode({ type: "partial", text: partial })));
              },
            );
            controller.enqueue(
              encoder.encode(sseEncode({ type: "done", text, durationSec })),
            );
            if (process.env.NODE_ENV === "development") {
              const preview = text ? text.slice(0, 80) : "(empty)";
              console.log(
                `[transcribe:stream] ${Date.now() - t0}ms wall, ${durationSec.toFixed(1)}s audio → ${preview}`,
              );
            }
          } catch (error) {
            const { message, status } = mapOpenAiError(error, "Transcription failed");
            controller.enqueue(
              encoder.encode(sseEncode({ type: "error", error: message, status })),
            );
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    let text = "";
    let durationSec = 0;
    if (audioBase64) {
      ({ text, durationSec } = await transcribeWavBase64(audioBase64, language));
    } else {
      ({ text, durationSec } = await transcribeWavBuffer(buffer!, language));
    }

    if (process.env.NODE_ENV === "development") {
      const preview = text ? text.slice(0, 80) : "(empty)";
      console.log(`[transcribe] ${Date.now() - t0}ms wall, ${durationSec.toFixed(1)}s audio → ${preview}`);
    }
    return json({ text, durationSec });
  } catch (error) {
    const { message, status } = mapOpenAiError(error, "Transcription failed");
    if (process.env.NODE_ENV === "development") {
      console.error(`[transcribe] ${status}: ${message}`);
    }
    return json({ error: message }, { status });
  }
}
