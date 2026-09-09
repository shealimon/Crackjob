import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, optionsCors } from "@/lib/http";
import { mapOpenAiError } from "@/lib/openai-errors";
import { transcribeWavBuffer, transcribeWavBase64 } from "@/lib/transcribe";

const jsonSchema = z.object({
  audioBase64: z.string().min(100),
  language: z.string().max(40).optional(),
});

export function OPTIONS() {
  return optionsCors();
}

export async function POST(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const t0 = Date.now();
  try {
    const contentType = request.headers.get("content-type") || "";
    let text = "";
    let durationSec = 0;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("audio");
      const language =
        typeof form.get("language") === "string" ? String(form.get("language")) : undefined;
      if (!(file instanceof Blob) || file.size < 1000) {
        return json({ error: "Send audio file (WAV)" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      ({ text, durationSec } = await transcribeWavBuffer(buffer, language));
    } else {
      const body = jsonSchema.safeParse(await request.json().catch(() => null));
      if (!body.success) {
        return json({ error: "Send audioBase64 (WAV) or multipart audio" }, { status: 400 });
      }
      ({ text, durationSec } = await transcribeWavBase64(
        body.data.audioBase64,
        body.data.language,
      ));
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
