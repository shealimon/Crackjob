import { requireUser } from "@/lib/api-auth";
import { json, optionsCors } from "@/lib/http";
import { PROFILE_SELECT, toPublicProfile } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import {
  isSupportedResumeFilename,
  parseResumeFile,
} from "@/lib/resume-parse";
import { MAX_RESUME_BYTES } from "@/lib/request-limits";
import {
  removeResumeObject,
  uploadResumeObject,
} from "@/lib/supabase/admin";

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
          "Unsupported file type. Upload PDF, DOC, DOCX, TXT, MD, or RTF.",
      },
      { status: 400 },
    );
  }

  if (entry.size > MAX_RESUME_BYTES) {
    return json({ error: "Resume file is too large (max 8 MB)." }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await entry.arrayBuffer());
    const parsed = await parseResumeFile(buffer, filename);
    const mimeType = entry.type || "application/octet-stream";

    const existing = await prisma.profile.findUnique({
      where: { userId: authed.userId },
      select: { resumeFilePath: true },
    });

    let resumeFilePath: string | null = null;
    try {
      resumeFilePath = await uploadResumeObject({
        userId: authed.userId,
        filename,
        buffer,
        contentType: mimeType,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        return json(
          {
            error:
              "Resume storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY.",
          },
          { status: 503 },
        );
      }
      throw error;
    }

    const profile = await prisma.profile.upsert({
      where: { userId: authed.userId },
      create: {
        userId: authed.userId,
        resumeText: parsed.text,
        resumeFileName: filename,
        resumeFilePath,
        resumeMimeType: mimeType,
      },
      update: {
        resumeText: parsed.text,
        resumeFileName: filename,
        resumeFilePath,
        resumeMimeType: mimeType,
      },
      select: PROFILE_SELECT,
    });

    if (
      existing?.resumeFilePath &&
      existing.resumeFilePath !== resumeFilePath
    ) {
      await removeResumeObject(existing.resumeFilePath);
    }

    return json({
      profile: toPublicProfile(profile),
      truncated: parsed.truncated,
      charCount: parsed.text.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not upload resume";
    return json({ error: message }, { status: 400 });
  }
}
