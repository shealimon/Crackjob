import { prisma } from "@/lib/prisma";
import { RESUME_TEXT_MAX } from "@/lib/resume-parse";

export type ProfileResumeAnchors = {
  jobRole?: string | null;
  currentCompany?: string | null;
  yearsOfExperience?: number | null;
  currentLocation?: string | null;
  preferredLocations?: string | null;
  preferredStack?: string | null;
};

/** Prefixed profile facts + resume body for the answer engine. */
export function buildResumeExtraContext(options: {
  resumeText: string;
  profile?: ProfileResumeAnchors | null;
}): string {
  const resume = options.resumeText.trim().slice(0, RESUME_TEXT_MAX);
  const profile = options.profile;
  const lines: string[] = [];

  if (profile) {
    const facts: string[] = [];
    if (profile.jobRole?.trim()) facts.push(`Current / target role: ${profile.jobRole.trim()}`);
    if (profile.currentCompany?.trim()) {
      facts.push(`Current company: ${profile.currentCompany.trim()}`);
    }
    if (
      profile.yearsOfExperience !== null &&
      profile.yearsOfExperience !== undefined &&
      Number.isFinite(profile.yearsOfExperience)
    ) {
      facts.push(`Profile years of experience: ${profile.yearsOfExperience}`);
    }
    if (profile.currentLocation?.trim()) {
      facts.push(`Current location: ${profile.currentLocation.trim()}`);
    }
    if (profile.preferredLocations?.trim()) {
      facts.push(`Preferred locations: ${profile.preferredLocations.trim()}`);
    }
    if (profile.preferredStack?.trim()) {
      facts.push(`Preferred stack: ${profile.preferredStack.trim()}`);
    }
    if (facts.length) {
      lines.push("PROFILE FIELDS (use when relevant; resume still wins on conflicts):");
      for (const fact of facts) lines.push(`- ${fact}`);
    }
  }

  if (resume) {
    if (lines.length) lines.push("");
    lines.push(resume);
  }

  return lines.join("\n").trim();
}

/**
 * Prefer the longer of client-sent resume vs cloud profile resume,
 * and always fold in structured profile fields when present.
 */
export async function resolveExtraContext(
  userId: string,
  clientExtra?: string | null,
): Promise<string | undefined> {
  const client = clientExtra?.trim() || "";

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      resumeText: true,
      jobRole: true,
      currentCompany: true,
      yearsOfExperience: true,
      currentLocation: true,
      preferredLocations: true,
      preferredStack: true,
    },
  });

  const profileResume = profile?.resumeText?.trim() || "";
  const resumeText =
    client.length >= profileResume.length ? client : profileResume;

  if (!resumeText && !profile) return undefined;

  const merged = buildResumeExtraContext({ resumeText, profile });
  return merged || undefined;
}
