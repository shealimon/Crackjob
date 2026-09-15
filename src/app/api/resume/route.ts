import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, optionsCors } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { normalizeResumeText, RESUME_TEXT_MAX } from "@/lib/resume-parse";

export function OPTIONS() {
  return optionsCors();
}

/** Desktop pulls cloud resume so website Profile upload powers interview answers. */
export async function GET(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: authed.userId },
    select: {
      resumeText: true,
      resumeFileName: true,
      resumeFilePath: true,
    },
  });

  const resumeText = profile?.resumeText?.trim() || "";
  return json({
    resumeText,
    resumeFileName: profile?.resumeFileName ?? null,
    hasResume: Boolean(resumeText || profile?.resumeFilePath),
    charCount: resumeText.length,
  });
}

const patchSchema = z.object({
  text: z.string().max(RESUME_TEXT_MAX + 2000),
});

/** Save pasted resume text from desktop settings into the cloud profile. */
export async function PATCH(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const body = patchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return json({ error: "Send { text } resume body" }, { status: 400 });
  }

  const normalized = normalizeResumeText(body.data.text);
  const profile = await prisma.profile.upsert({
    where: { userId: authed.userId },
    create: {
      userId: authed.userId,
      resumeText: normalized || null,
      resumeFileName: normalized ? "pasted-resume.txt" : null,
    },
    update: {
      resumeText: normalized || null,
      ...(normalized
        ? {}
        : {
            resumeFileName: null,
            resumeFilePath: null,
            resumeMimeType: null,
          }),
    },
    select: {
      resumeText: true,
      resumeFileName: true,
      resumeFilePath: true,
    },
  });

  const resumeText = profile.resumeText?.trim() || "";
  return json({
    resumeText,
    resumeFileName: profile.resumeFileName,
    hasResume: Boolean(resumeText || profile.resumeFilePath),
    charCount: resumeText.length,
  });
}
