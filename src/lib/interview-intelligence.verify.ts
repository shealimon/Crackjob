/**
 * Interview response intelligence + Live calibration wiring tests.
 * Run: npx tsx src/lib/interview-intelligence.verify.ts
 */
import { assembleSolveUserText } from "./ai";
import {
  buildInterviewResponseIntelligenceSection,
  buildLiveAnswerCalibrationSections,
} from "./interview-intelligence";
import {
  buildScreenshotStreamPrompt,
  buildStreamPrompt,
  selectSolveSystemPrompt,
} from "./prompts";
import { buildInteractiveExperienceSystemSection } from "./live-experience";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const intel = buildInterviewResponseIntelligenceSection();

// 1. Simple question → concise answer (prompt rule)
{
  assert(/simple or narrow questions stay concise/i.test(intel), "T1: concise simple asks");
  assert(/outline-only or definition-only/i.test(intel), "T1: anti-thin complex asks");
  assert(/not a template/i.test(intel), "T1: no fixed length template");
}

// 2. Senior-level complex question → sufficiently deep (experience + intelligence)
{
  const senior = buildLiveAnswerCalibrationSections(12);
  assert(/senior band/i.test(senior), "T2: senior band present");
  assert(/Complex hands-on or design asks need enough detail/i.test(senior), "T2: complex depth");
  assert(/multi-part, design-sized, implementation, or detail-explicit/i.test(intel), "T2: deep when needed");
}

// 3. "Show me code" → code included
{
  assert(/show me code/i.test(intel), "T3: show me code cue");
  assert(/fenced blocks when the candidate must write or run code/i.test(intel), "T3: code fences");
}

// 4. "How would you implement" → implementation details
{
  assert(/how would you implement/i.test(intel), "T4: implement cue");
  const shot = buildScreenshotStreamPrompt({ liveExperienceYears: 8 });
  assert(/runnable code when the problem expects implementation/i.test(shot), "T4: implementation on screen");
}

// 5. Question requiring SQL → SQL included
{
  assert(/SQL query/i.test(intel), "T5: SQL as component");
  assert(/write the query/i.test(intel), "T5: write query cue");
  const text = buildStreamPrompt("dsa", { liveExperienceYears: 5 });
  assert(/SQL \/ data: correct query/i.test(text), "T5: SQL shape in text prompt");
}

// 6. Follow-up → only required continuation
{
  assert(/follow-ups continue the same thread and cover only the next slice/i.test(intel), "T6: follow-up slice");
  const user = assembleSolveUserText({
    mode: "dsa",
    questionText: "What about edge cases?",
    conversationContext: "Q: Two sum\nA: I'd use a hash map",
    liveExperience: { years: 6, band: "mid", source: "profile" },
  });
  assert(/Answer ONLY that latest ask/i.test(user), "T6: follow-up user rules");
  assert(!user.includes("INTERACTIVE"), "T6: non-interactive text path");
}

// 7. Same question at different experience levels → maturity/depth changes
{
  const j = buildInteractiveExperienceSystemSection(1);
  const s = buildInteractiveExperienceSystemSection(12);
  assert(j.includes("fundamentals") && s.includes("architecture and design decisions"), "T7: band depth differs");
  assert(j !== s, "T7: sections differ by years");
  const shotJunior = buildScreenshotStreamPrompt({ liveExperienceYears: 1 });
  const shotSenior = buildScreenshotStreamPrompt({ liveExperienceYears: 12 });
  assert(shotJunior !== shotSenior, "T7: screenshot prompts differ by experience");
}

// Non-interactive paths receive intelligence + experience when years passed
{
  const selected = selectSolveSystemPrompt({
    mode: "dsa",
    questionText: "Explain CAP theorem",
    liveExperienceYears: 10,
  });
  assert(selected.includes("INTERVIEW RESPONSE INTELLIGENCE"), "T8: text path intelligence");
  assert(selected.includes("10 years"), "T8: text path experience years");
}

// Intelligence always present even without explicit years (defaults experience block omitted)
{
  const shot = buildScreenshotStreamPrompt();
  assert(shot.includes("INTERVIEW RESPONSE INTELLIGENCE"), "T9: intelligence without years");
  assert(!shot.includes("EXPERIENCE-AWARE ANSWER DEPTH"), "T9: no experience block without years");
}

console.log("interview-intelligence.verify: all checks passed");
