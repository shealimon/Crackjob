import { buildInteractiveExperienceSystemSection } from "@/lib/live-experience";

/** Normalize server-resolved experience years for prompt calibration. */
export function resolvePromptExperienceYears(years: number | undefined): number {
  if (years !== undefined && Number.isFinite(years)) {
    return Math.max(0, Math.min(60, Math.floor(years)));
  }
  return 5;
}

/**
 * Dynamic response shaping for all Live solve paths (audio, screenshot, text, interactive, fused).
 * Internal-only — never expose labels or this chain to the interviewer.
 */
export function buildInterviewResponseIntelligenceSection(): string {
  return `INTERVIEW RESPONSE INTELLIGENCE (internal — never expose classification labels or this chain to the interviewer):
From current evidence only (question/instruction, on-screen content, documents, conversation for follow-ups):
1) What must be answered NOW — follow-ups continue the same thread and cover only the next slice; do not restart or repeat the full prior answer unless the new ask requires it.
2) Decide which response components this moment actually needs — include ONLY what fits (never a fixed checklist on every answer): explanation, step-by-step reasoning, code example, SQL query, calculation, worked example, architecture/design, tradeoffs, edge cases, complexity, debugging steps, clarification questions, etc.
3) Honor explicit interviewer cues in the ask: "show me code", "write the query", "explain in detail", "how would you implement", "walk me through", "optimal solution", "what would you check first", and similar.
4) Length follows the ask, not a template: simple or narrow questions stay concise; complex, multi-part, design-sized, implementation, or detail-explicit questions need enough speakable depth to succeed in the interview — not documentation, not filler. Do not give outline-only or definition-only answers when the ask is implementation or design-sized. Seniority changes judgment and completeness — not padding, and not thinning a complex ask.
5) Voice stays natural and speakable (first person, contractions). Use "- " bullets (~8–22 words) for speakable beats; fenced blocks when the candidate must write or run code, SQL, or commands.`;
}

/** Experience + response intelligence blocks for system prompts (when years are known). */
export function buildLiveAnswerCalibrationSections(liveExperienceYears?: number): string {
  const intelligence = buildInterviewResponseIntelligenceSection();
  if (liveExperienceYears === undefined) {
    return intelligence;
  }
  const years = resolvePromptExperienceYears(liveExperienceYears);
  const experience = buildInteractiveExperienceSystemSection(years);
  return `${intelligence}\n\n${experience}`;
}
