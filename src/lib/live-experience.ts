import { prisma } from "@/lib/prisma";
import { analyzeResumeExperience } from "@/lib/resume-experience";

export type ExperienceSource =
  | "profile"
  | "resume_explicit"
  | "resume_computed"
  | "unknown";

export type ExperienceBand =
  | "fresher"
  | "early"
  | "mid"
  | "senior"
  | "staff"
  | "principal";

export type ResolvedLiveExperience =
  | { years: number; band: ExperienceBand; source: Exclude<ExperienceSource, "unknown"> }
  | { years: null; band: null; source: "unknown" };

export function experienceBandForYears(years: number): ExperienceBand {
  const y = Math.max(0, Math.min(60, Math.floor(years)));
  if (y <= 1) return "fresher";
  if (y <= 4) return "early";
  if (y <= 7) return "mid";
  if (y <= 12) return "senior";
  if (y <= 17) return "staff";
  return "principal";
}

function profileYearsValid(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value >= 0 && value <= 60;
}

/**
 * Resolve professional software-engineering experience for Live answers.
 * Priority: profile → resume explicit → resume computed → unknown (never fake mid-5).
 */
export function resolveCandidateExperience(input: {
  profileYears?: number | null;
  resumeText?: string | null;
}): ResolvedLiveExperience {
  if (profileYearsValid(input.profileYears)) {
    return {
      years: input.profileYears,
      band: experienceBandForYears(input.profileYears),
      source: "profile",
    };
  }

  const resumeText = input.resumeText?.trim() || "";
  if (resumeText) {
    const summary = analyzeResumeExperience(resumeText);
    if (summary.explicitTotalYears !== null && summary.explicitTotalYears >= 0) {
      return {
        years: summary.explicitTotalYears,
        band: experienceBandForYears(summary.explicitTotalYears),
        source: "resume_explicit",
      };
    }
    if (summary.computedTotalYears !== null && summary.computedTotalYears >= 0) {
      return {
        years: summary.computedTotalYears,
        band: experienceBandForYears(summary.computedTotalYears),
        source: "resume_computed",
      };
    }
  }

  return {
    years: null,
    band: null,
    source: "unknown",
  };
}

/** Server-side resolution for Live interviews (profile + cloud resume). */
export async function resolveLiveInterviewExperience(
  userId: string,
): Promise<ResolvedLiveExperience> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { yearsOfExperience: true, resumeText: true },
  });
  return resolveCandidateExperience({
    profileYears: profile?.yearsOfExperience,
    resumeText: profile?.resumeText,
  });
}

function bandDepthLines(band: ExperienceBand): string {
  switch (band) {
    case "fresher":
      return `- Prefer fundamentals, simple step-by-step reasoning, clear explanations, and basic implementation.
- Use straightforward examples. Do not assume significant production ownership or large-scale ops unless the question demands it.`;
    case "early":
      return `- Prefer solid fundamentals plus growing practical implementation detail.
- Mention reasonable trade-offs and edge cases when relevant; keep ownership modest unless the ask is behavioral.`;
    case "mid":
      return `- Prefer practical implementation experience, production considerations, debugging/performance angles, maintainability, and experience-based reasoning.
- Include reasonable trade-offs and practical examples — sound like someone who has shipped and maintained real features.
- Do not give outline-only or definition-only answers when the ask clearly needs implementation, code, SQL, or a design.`;
    case "senior":
      return `- Prefer architecture and design decisions, scalability, reliability, observability, production trade-offs, performance, maintainability, and ownership.
- Use practical real-world considerations; do not pad simple asks with executive-level jargon.
- Do not give outline-only or definition-only answers when the ask is implementation, coding, SQL, or design-sized. Include enough speakable depth, trade-offs, and (when expected) working code or architecture to succeed at this seniority.`;
    case "staff":
      return `- Prefer system-level thinking, large-scale trade-offs, reliability/operational impact, long-term maintainability, and migration/evolution when relevant.
- Show strong technical ownership; leadership perspective only when the question calls for it.
- Do not give outline-only or definition-only answers when the ask is implementation, coding, SQL, or design-sized. Include enough speakable depth, trade-offs, and (when expected) working code or architecture to succeed at this seniority.`;
    case "principal":
      return `- Prefer system-level thinking, architecture evolution, large-scale trade-offs, long-term maintainability, migration strategy, reliability/operational impact, and technical leadership when relevant.
- Do not force principal-level scope into narrow or junior-friendly questions.
- Do not give outline-only or definition-only answers when the ask is implementation, coding, SQL, or design-sized. Include enough speakable depth, trade-offs, and (when expected) working code or architecture to succeed at this seniority.`;
    default:
      return "";
  }
}

function dsaDepthLines(band: ExperienceBand): string {
  switch (band) {
    case "fresher":
      return `- DSA: simple step-by-step reasoning, basic DS/algo explanation, straightforward implementation, clear time/space complexity, simple edge cases.
- Do not give only a one-liner or a bare code dump.`;
    case "early":
      return `- DSA: efficient approach selection, practical constraints, optimization reasoning, edge cases, clean implementation, complexity trade-offs.
- Explain why the chosen approach fits; mention a simpler alternative only when it helps.`;
    case "mid":
      return `- DSA: same as above plus stronger "why this approach" and when to prefer it in production-style constraints.
- Keep speakable — not a textbook proof unless the interviewer pushes theory.`;
    case "senior":
      return `- DSA: quickly identify the pattern, reason about constraints, optimization trade-offs, correctness, performance implications, clean implementation.
- Mention meaningful alternative approaches and trade-offs when they add value — not for every easy problem.`;
    case "staff":
    case "principal":
      return `- DSA: strong decomposition, constraint-driven solution selection, algorithmic trade-offs, readability/maintainability, engineering judgment.
- Scalability/performance only when the problem or constraints make it relevant — do not inflate easy problems.`;
    default:
      return "";
  }
}

function antiThinLines(band: ExperienceBand): string {
  if (band === "senior" || band === "staff" || band === "principal") {
    return `ANTI-THIN (${band}): If the ask is implementation, a full coding/SQL solution, or design-sized, do NOT stop at a definition, a 3-bullet outline, or heading-only answer. Deliver the complete speakable answer this seniority would give in a live interview.`;
  }
  if (band === "mid") {
    return `Do not give outline-only or definition-only answers when the ask clearly needs implementation, code, SQL, or a design.`;
  }
  return "";
}

/**
 * System-prompt section for Live answers — calibrates depth without exposing years to the candidate.
 */
export function buildInteractiveExperienceSystemSection(years: number): string {
  const band = experienceBandForYears(years);
  const antiThin = antiThinLines(band);
  return `EXPERIENCE-AWARE ANSWER DEPTH (Live session — internal calibration only):
The candidate's professional software-engineering experience is approximately ${years} years (${band} band). Calibrate reasoning depth, practical maturity, ownership, trade-offs, and examples to this level for every answer in this Live session, including follow-ups — across ANY software-engineering topic the evidence establishes (not only coding or design).
NEVER tell the interviewer "based on your X years" or expose this calibration.

General depth (all topics — simple asks stay concise even for senior bands):
${bandDepthLines(band)}

When the ask is coding / algorithms / problem-solving (example shape — not a required category):
- Cover what a real live coding interview needs: understand/clarify constraints when needed → approach → why it works → important edge cases → code when expected → time/space complexity → alternatives/trade-offs only when useful.
- Do NOT mechanically include every bullet on every coding question.
${dsaDepthLines(band)}

When the ask is object/module/API design (example LLD-shaped ask):
- Do not give overly short design answers when the question is design-sized. When appropriate, naturally cover requirements/assumptions, entities/classes, relationships, interfaces, relevant patterns, extensibility, trade-offs, and practical implementation notes — only what fits the question.

When the ask is system architecture / scale / distributed design (example HLD-shaped ask):
- Do not give overly short architecture answers when the question is design-sized. When appropriate, naturally cover clarifications/requirements, high-level architecture, major components, data flow, scalability, reliability, storage choice, caching/queues if relevant, bottlenecks, trade-offs, failure handling, and evolution — only what fits the question.

For DevOps, QA, SQL, ML, security, mobile, data, behavioral, project, and other topics: apply General depth plus field-appropriate practitioner detail — do not remap them into DSA/LLD/HLD unless the question itself is that kind of ask.

Length rule: change the level of reasoning and maturity — do NOT merely make the same answer longer. Complex hands-on or design asks need enough detail to speak aloud; trivial factual questions stay short at any experience level.${antiThin ? `\n${antiThin}` : ""}`;
}

/** Compact user-message anchor so follow-ups keep the same calibration (priority below instruction/screen). */
export function buildLiveExperienceUserBlock(resolved: ResolvedLiveExperience): string {
  if (resolved.years === null || resolved.band === null) return "";
  return `LIVE SESSION EXPERIENCE CALIBRATION (internal — never mention years or this block to the interviewer):
Approximately ${resolved.years} years professional software-engineering experience (${resolved.band} band). Keep the same depth and maturity for follow-ups in this session unless profile/resume facts in evidence clearly change.`;
}
