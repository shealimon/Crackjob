import { requireUser } from "@/lib/api-auth";
import { json, optionsCors } from "@/lib/http";
import { isSupportedResumeFilename, parseResumeFile } from "@/lib/resume-parse";

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
    return json({ error: "Send resume as multipart form field 'file'" }, { status: 400 });
  }

  const entry = form.get("file");
  if (!(entry instanceof File)) {
    return json({ error: "Missing resume file" }, { status: 400 });
  }

  const filename = entry.name?.trim() || "resume.pdf";
  if (!isSupportedResumeFilename(filename)) {
    return json(
      {
        error:
          "Unsupported file type. Upload PDF, DOC, DOCX, TXT, MD, or RTF — or paste your resume.",
      },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await entry.arrayBuffer());
    const parsed = await parseResumeFile(buffer, filename);
    return json({
      text: parsed.text,
      truncated: parsed.truncated,
      filename,
      charCount: parsed.text.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not parse resume";
    return json({ error: message }, { status: 400 });
  }
}
