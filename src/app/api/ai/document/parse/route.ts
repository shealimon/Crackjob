import { requireUser } from "@/lib/api-auth";
import { json, optionsCors } from "@/lib/http";
import {
  isSupportedDocumentFilename,
  parseDocumentFile,
} from "@/lib/resume-parse";

export const runtime = "nodejs";

export function OPTIONS() {
  return optionsCors();
}

export async function POST(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return json({ error: "Send file as multipart form field 'file'" }, { status: 400 });
  }

  const entry = form.get("file");
  if (!(entry instanceof File)) {
    return json({ error: "Missing file" }, { status: 400 });
  }

  const filename = entry.name?.trim() || "document.pdf";
  if (!isSupportedDocumentFilename(filename)) {
    return json(
      {
        error:
          "Unsupported file type. Attach PDF, DOC, DOCX, TXT, MD, or RTF.",
      },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await entry.arrayBuffer());
    const parsed = await parseDocumentFile(buffer, filename);
    return json({
      text: parsed.text,
      truncated: parsed.truncated,
      filename,
      charCount: parsed.text.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not parse document";
    return json({ error: message }, { status: 400 });
  }
}
