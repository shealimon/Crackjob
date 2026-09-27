/**
 * Interactive Live experience resolution + prompt calibration tests.
 * Run: npx tsx src/lib/live-experience.verify.ts
 */
import { assembleSolveUserText, type SolveOptions } from "./ai";
import {
  buildInteractiveHandsOnPrompt,
  buildScreenshotStreamPrompt,
  selectSolveSystemPrompt,
} from "./prompts";
import {
  buildInteractiveExperienceSystemSection,
  buildLiveExperienceUserBlock,
  experienceBandForYears,
  resolveCandidateExperience,
  type ResolvedLiveExperience,
} from "./live-experience";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const RESUME_EXPLICIT = `
Jane Doe
Software Engineer
Total professional experience: 10+ years
Acme 2018 - Present
`;

const RESUME_DATES = `
John Smith
Senior Engineer
Foo Corp Jan 2016 - Dec 2019
Bar Inc Jan 2020 - Present
`;

const RESUME_THIN = `
Alex Dev
Built a college todo app in React.
`;

// 1. Profile experience wins
{
  const r = resolveCandidateExperience({ profileYears: 8, resumeText: RESUME_EXPLICIT });
  assert(r.source === "profile" && r.years === 8, "T1: profile years used");
}

// 2. Resume explicit when profile missing
{
  const r = resolveCandidateExperience({ profileYears: null, resumeText: RESUME_EXPLICIT });
  assert(r.source === "resume_explicit" && r.years === 10, "T2: resume explicit used");
}

// 3. Unknown when profile and resume have no reliable years (never fake mid-5)
{
  const r = resolveCandidateExperience({ profileYears: null, resumeText: RESUME_THIN });
  assert(r.source === "unknown" && r.years === null && r.band === null, "T3: unknown not fake 5");
}

// 3b. Computed from employment dates when no explicit total
{
  const r = resolveCandidateExperience({ profileYears: undefined, resumeText: RESUME_DATES });
  assert(r.source === "resume_computed" && r.years >= 5, "T3b: resume computed from dates");
}

// 4. DSA prompt depth differs by experience band
{
  const fresher = buildInteractiveHandsOnPrompt({ liveExperienceYears: 0 });
  const mid = buildInteractiveHandsOnPrompt({ liveExperienceYears: 5 });
  const senior = buildInteractiveHandsOnPrompt({ liveExperienceYears: 10 });
  assert(fresher.includes("simple step-by-step reasoning"), "T4: fresher DSA");
  assert(mid.includes("production-style constraints") || mid.includes("shipped and maintained"), "T4: mid DSA");
  assert(senior.includes("quickly identify the pattern"), "T4: senior DSA");
  assert(fresher !== senior, "T4: fresher vs senior prompts differ");
}

// 5. LLD-shaped depth guidance present at all bands (example, not exclusive category)
{
  for (const years of [0, 5, 10]) {
    const p = buildInteractiveHandsOnPrompt({ liveExperienceYears: years });
    assert(
      /object\/module\/API design/.test(p) && /Do not give overly short design answers when the question is design-sized/.test(p),
      `T5: LLD-shaped section years=${years}`,
    );
  }
}

// 6. HLD-shaped depth guidance (example, not exclusive category)
{
  for (const years of [0, 5, 10]) {
    const p = buildInteractiveHandsOnPrompt({ liveExperienceYears: years });
    assert(
      /system architecture \/ scale/.test(p) && /Do not give overly short architecture answers/.test(p),
      `T6: HLD-shaped years=${years}`,
    );
  }
}

// 7. Follow-ups: same experience block in user content (interactive + voice/text)
{
  const resolved: ResolvedLiveExperience = {
    years: 10,
    band: "senior",
    source: "profile",
  };
  const a = assembleSolveUserText({
    mode: "dsa",
    interactiveHandsOn: true,
    questionText: "What is the time complexity?",
    liveExperience: resolved,
  });
  const b = assembleSolveUserText({
    mode: "lld",
    interactiveHandsOn: true,
    questionText: "Add a new entity for notifications",
    liveExperience: resolved,
    conversationContext: "Q: Design parking lot\nA: I'd start with EntryGate",
  });
  const c = assembleSolveUserText({
    mode: "dsa",
    questionText: "Can you show the code?",
    liveExperience: resolved,
    conversationContext: "Q: LRU cache\nA: Hash map plus doubly linked list",
  });
  assert(a.includes("10 years") && b.includes("10 years") && c.includes("10 years"), "T7: same years in follow-up turns");
  assert(
    a.includes("Keep the same depth") && b.includes("Keep the same depth") && c.includes("Keep the same depth"),
    "T7: session consistency hint",
  );
}

// 8. Simple questions stay concise (prompt rule)
{
  const p = buildInteractiveHandsOnPrompt({ liveExperienceYears: 15 });
  assert(/trivial factual questions stay short/i.test(p), "T8: concise simple asks for senior");
}

// 9. Complex DSA — sufficient explanation guidance
{
  const fresher = buildInteractiveExperienceSystemSection(0);
  const mid = buildInteractiveExperienceSystemSection(5);
  assert(/Do not give only a one-liner or a bare code dump/.test(fresher), "T9: anti code-dump");
  assert(/understand\/clarify constraints/.test(mid), "T9: DSA flow");
  assert(/Complex hands-on or design asks need enough detail/.test(mid), "T9: complex depth rule");
}

// 10. Complex LLD/HLD-shaped — not overly short
{
  const p = buildInteractiveExperienceSystemSection(10);
  assert(/Do not give overly short design answers when the question is design-sized/.test(p), "T10: LLD-shaped length");
  assert(/Do not give overly short architecture answers/.test(p), "T10: HLD-shaped length");
  assert(/do not give outline-only or definition-only/i.test(p), "T10: senior anti-thin");
  assert(/ANTI-THIN \(senior\)/.test(p), "T10: anti-thin label");
}

// 13. Step 10A — DSA/LLD/HLD are examples; other domains explicitly supported
{
  const p = buildInteractiveHandsOnPrompt({ liveExperienceYears: 5 });
  assert(/DYNAMIC INTERVIEW INTELLIGENCE/.test(p), "T13: dynamic intelligence section");
  assert(/There is no closed domain enum/.test(p), "T13: no closed enum");
  assert(/examples only — NOT an exhaustive list/.test(p), "T13: examples not restrictions");
  assert(/Never force every answer into DSA, LLD, or HLD/.test(p), "T13: no forced DSA/LLD/HLD");
  assert(/Any other software-engineering topic/.test(p), "T13: unlisted domains supported");
  assert(/DevOps \/ cloud \/ SRE/.test(p) && /QA \/ testing/.test(p), "T13: example domains listed");
  const exp = buildInteractiveExperienceSystemSection(5);
  assert(/do not remap them into DSA\/LLD\/HLD unless/.test(exp), "T13: experience section non-routing");
}

// 11. Experience does not change non-interactive mode routing
{
  const shot = buildScreenshotStreamPrompt({ mode: "dsa", liveExperienceYears: 5 });
  const selected = selectSolveSystemPrompt({
    mode: "system_design",
    questionText: "Design Twitter",
    imageBase64: undefined,
    interactiveHandsOn: false,
    liveExperienceYears: 5,
  });
  assert(selected.includes("Round focus") && selected.includes("5 years"), "T11: non-Live mode + experience wired");
  const liveDsa = selectSolveSystemPrompt({ mode: "dsa", interactiveHandsOn: true, liveExperienceYears: 5 });
  const liveHld = selectSolveSystemPrompt({
    mode: "system_design",
    interactiveHandsOn: true,
    liveExperienceYears: 5,
  });
  assert(liveDsa === liveHld, "T11: Live prompt stays mode-agnostic (auto-detect from evidence)");
}

// 12. Non-Live interactiveHandsOn false unchanged vs screenshot baseline
{
  const base = selectSolveSystemPrompt({ mode: "dsa", interactiveHandsOn: false });
  const shot = buildScreenshotStreamPrompt({ mode: "dsa" });
  assert(base === shot, "T12: non-Live screenshot prompt unchanged");
}

// Bands cover requested ranges
{
  assert(experienceBandForYears(0) === "fresher", "band fresher");
  assert(experienceBandForYears(3) === "early", "band 2-4");
  assert(experienceBandForYears(6) === "mid", "band 5-7");
  assert(experienceBandForYears(10) === "senior", "band 8-12");
  assert(experienceBandForYears(15) === "staff", "band 13-17");
  assert(experienceBandForYears(20) === "principal", "band 18+");
}

// User block must not instruct candidate to announce years
{
  const block = buildLiveExperienceUserBlock({
    years: 10,
    band: "senior",
    source: "profile",
  });
  assert(/never mention years/i.test(block), "user block is internal");
}

{
  const unknown = buildLiveExperienceUserBlock({
    years: null,
    band: null,
    source: "unknown",
  });
  assert(unknown === "", "unknown experience omits user calibration block");
}

{
  const none = buildInteractiveHandsOnPrompt();
  assert(!none.includes("EXPERIENCE-AWARE ANSWER DEPTH"), "no fake mid-5 when years omitted");
}

console.log("live-experience.verify: all checks passed");
