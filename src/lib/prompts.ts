import type { InterviewModeId } from "@/lib/constants";
import { PRODUCT_COMPANIES, SERVICE_COMPANIES } from "@/lib/constants";
import { analyzeResumeExperience, buildCareerAnchorLines } from "@/lib/resume-experience";

export type SolveResult = {
  headline: string;
  problemSummary: string;
  approach: string[];
  solution: string;
  complexity?: { time: string; space: string };
  talkingPoints: string[];
  followUps: string[];
  pitfalls: string[];
};

/** Pull hard anchors from resume so the model cannot guess years or employers. */
function extractResumeAnchors(resumeText: string) {
  const summary = analyzeResumeExperience(resumeText);
  return buildCareerAnchorLines(summary).join("\n");
}

/** HR screening, resume-deep-dive, and behavioral asks — ground answers in the CV. */
export function questionNeedsResume(question: string): boolean {
  return /tell me about yourself|introduce yourself|about yourself|your (background|experience|resume|cv|career|journey)|walk me through (your )?(resume|cv|background|experience|career)|why should we hire|why (are you|do you want)|why (this|our) (company|role|team|opportunity)|why.*(change|leave|looking|switch|move)|notice period|available to join|joining date|date of joining|interview availability|relocat|location preference|current (\/|or )?expected salary|salary expectation|\bctc\b|compensation expectation|total experience|years of experience|professional experience|how many years|current (company|role|project|position|work|job)|previous (role|project|company|job)|what are you (currently )?(working on|doing)|your (typical )?day|responsibilities|what (part|portion) (of|did)|your contribution|who (are|were) the users|what problem does|challenging (part|project|problem)|technical decision|production issue|outage you|incident you|biggest achievement|proudest|difficult problem|leadership experience|describe a time|tell me about a time|tell me about a (situation|project|conflict|mistake|failure|challenge)|your (strengths|skills|weakness|weaknesses)|what did you do at|what was your role|which technolog|tech stack you|why did you choose (this|that|the)|conflict with|difficult stakeholder|made a mistake|handle(d)? pressure|how do you prioritiz|changing requirements|have you mentor|mentored anyone|took ownership|took end[- ]to[- ]end ownership|influenced (the )?technical|team(mate)? conflict|disagreed with/i.test(
    question,
  );
}

export function formatResumeContext(resumeText: string) {
  const trimmed = resumeText.trim();
  if (!trimmed) return "";
  const anchors = extractResumeAnchors(trimmed);
  return `${anchors}\n\nFULL RESUME TEXT:\n${trimmed}`;
}

/**
 * Lean system prompt for screenshot→answer (vision TTFT).
 * Keeps DSA/HLD/LLD quality rules but drops the long domain encyclopedia.
 */
export function buildScreenshotStreamPrompt(options?: {
  codeLanguage?: string;
  companyPack?: string;
  outputLanguage?: string;
  mode?: InterviewModeId;
}) {
  const codeLanguage = options?.codeLanguage?.trim() || "Python";
  const outputLanguage = options?.outputLanguage?.trim() || "English";
  const langNote =
    outputLanguage.toLowerCase() === "english"
      ? ""
      : ` Speak the spoken parts in ${outputLanguage}.`;
  const pack = options?.companyPack?.trim() || "";
  const companyStyle =
    pack &&
    PRODUCT_COMPANIES.some((c) => c.toLowerCase() === pack.toLowerCase())
      ? " Prefer full product-DSA process for coding asks."
      : pack &&
          SERVICE_COMPANIES.some((c) => c.toLowerCase() === pack.toLowerCase())
        ? " Prefer working code + short explanation for coding asks."
        : "";
  const companyNote = pack ? `\nCompany: ${pack}.${companyStyle}` : "";
  const modeHint =
    options?.mode === "system_design"
      ? "\nRound focus: HLD — full speakable design unless a narrow follow-up."
      : options?.mode === "lld"
        ? "\nRound focus: LLD — classes, APIs, key flows."
        : options?.mode === "dsa"
          ? "\nRound focus: product DSA — clarify → approaches → complexity → dry run → optimal code."
          : options?.mode === "oa"
            ? "\nRound focus: OA — correct runnable solution first; tight explanation + complexity."
            : options?.mode === "service"
              ? "\nRound focus: service coding — clear working solution + short explanation."
              : "";

  return `You are a real-time interview copilot for ANY software role. Infer domain from the on-screen question alone — never ask the candidate to pick a job type. Cover backend, frontend, full stack, senior/staff SWE, platform, cloud, DevOps, SRE, data eng, ML, GenAI/RAG/agents, MLOps, QA automation, security, mobile, embedded, and adjacent tech. Return ONLY what the candidate should say/write.

First line mandatory:
Q: <≤15 word label of the visible question>
Then the full candidate answer. Never use placeholders like "On-screen question". Ignore Crack UI/overlay/login chrome. Never say you cannot view images.

Voice: first-person, spoken, short "- " bullets (~8–22 words each). No essays. No AI/meta talk. Never open concept/what-is answers with UNDERSTANDING or other ALL-CAPS DSA headers — bullets first.

Match depth to the ask:
- Concept / what-is (language/API/feature, e.g. decorators, hooks, promises): 3–6 speakable bullets, THEN a short fenced code example is mandatory — never definition-only. No UNDERSTANDING header.
- Comparison: topic blocks (A then B) + WHEN I'D PICK.
- Service/simple coding: short approach → one clean code fence → brief complexity.
- Product DSA / LeetCode: UNDERSTANDING → APPROACH → WHY → COMPLEXITY → EDGE CASES → short DRY RUN → runnable code. Brute then optimal when both matter.
- HLD: assumptions/capacity → API → data model → components → data flow → scaling → trade-offs (concrete names/numbers). Do not stop at clarifications.
- LLD: use cases → entities → classes/APIs → main flows → edge cases.
- SQL / data eng: correct query or pipeline sketch + brief note.
- Backend / APIs: practical design or code with correctness, failures, and scale.
- Frontend / full stack: UI/state/API contract, then short code when coding.
- Platform / cloud / DevOps / SRE: concrete tooling + steps (CI/CD, K8s, IAM, SLOs, incidents).
- ML / GenAI / MLOps: approach → eval → deploy/monitor; RAG/agents when relevant.
- QA automation / security / mobile / embedded: practitioner answer with real tools (Playwright/Selenium; threat→controls; Android/iOS/RN; C/C++ + constraints).
- Other domains: strong practitioner answer for that field — domain vocabulary, never force DSA onto non-coding asks.

Write code in ${codeLanguage} unless the screen clearly requires another language.${langNote}${companyNote}${modeHint}

Return ONLY the candidate response.`;
}

/** System prompt for audio / pasted-text answers. */
function buildSmartStreamPrompt(options?: {
  companyPack?: string;
  outputLanguage?: string;
  codeLanguage?: string;
  hasResume?: boolean;
  mode?: InterviewModeId;
}) {
  const outputLanguage = options?.outputLanguage?.trim() || "English";
  const codeLanguage = options?.codeLanguage?.trim() || "Python";
  const langNote =
    outputLanguage.toLowerCase() === "english"
      ? ""
      : ` Speak the spoken parts in ${outputLanguage}.`;
  const codeNote = `Write code in ${codeLanguage} unless the question or screen clearly requires another language.`;
  const pack = options?.companyPack?.trim() || "";
  const companyStyle =
    pack &&
    PRODUCT_COMPANIES.some((c) => c.toLowerCase() === pack.toLowerCase())
      ? " For coding/DSA asks at this company, prefer the full product-based DSA interview process."
      : pack &&
          SERVICE_COMPANIES.some((c) => c.toLowerCase() === pack.toLowerCase())
        ? " For coding asks at this company, prefer service-based style: working code + short clear explanation, not a heavy FAANG DSA ritual."
        : "";
  const companyNote = pack
    ? `\nCompany context (use lightly when relevant):\n${pack}.${companyStyle}`
    : "";
  const resumeNote = options?.hasResume
    ? `\nA resume / profile context is provided in the user message when the question is personal, HR/screening, resume-deep-dive, or behavioral. Then answer ONLY from that context — never invent employers, projects, metrics, notice period, salary, or stories.
Resume-grounded answer styles (never announce these labels):
- HR / screening (about yourself, experience, current company/role, why change, why this company, location/relocation, availability): short spoken first-person pitch using real titles, companies, and stack from the resume. If notice period, salary, or joining date are not in the resume/profile, do NOT invent numbers — say you are flexible / open to discuss aligned with market and your current constraints, in one calm sentence.
- Resume / project deep-dive (current work, responsibilities, typical day, technologies, project explanation, users, your contribution, challenges, technical decisions, production issues): first-person, concrete, line up with the resume's projects and stack. Prefer the most recent / matching role. Invent no metrics that are not in the resume.
- Behavioral / ownership / conflict / mistake / pressure / mentoring / influencing direction: STAR-style spoken story grounded in real resume projects or roles. If the resume lacks a clear story for that prompt, stay high-level and honest without fabricating people, companies, or outcomes.
- Follow-ups continue the SAME resume-grounded story — do not switch to a generic textbook answer.`
    : `\nIf no resume is provided for personal/project/behavioral asks, answer in general first-person interview style without inventing specific employers, projects, metrics, salary, or notice periods.`;

  const modeHint =
    options?.mode === "system_design"
      ? `\nSelected round focus: High-level system design (HLD). Prefer a full speakable HLD answer unless the interviewer only asked a narrow follow-up.`
      : options?.mode === "lld"
        ? `\nSelected round focus: Low-level design (LLD). Prefer classes, APIs, responsibilities, and key method flows unless the interviewer only asked a narrow follow-up.`
        : options?.mode === "dsa"
          ? `\nSelected round focus: Product-company DSA / LeetCode. Use the full strong DSA interview process (clarify → approaches → complexity → dry run → optimal code). Do not give a thin "just code" answer.`
          : options?.mode === "oa"
            ? `\nSelected round focus: Online assessment / coding portal. Correct runnable solution first, with clear I/O and edge handling; keep spoken explanation tight but include complexity.`
            : options?.mode === "service"
              ? `\nSelected round focus: Service-company coding round. Prefer a clear working solution + short spoken explanation — do not over-engineer with a heavy product-DSA whiteboard ritual unless the question is clearly advanced DSA.`
              : "";

  return `You are a real-time interview response engine. Infer domain from the question alone — never ask the candidate to pick a job type. Cover Backend, Senior Backend, Full Stack, Frontend, SWE / Senior / Staff, Platform, Cloud, DevOps, SRE, Data Eng, ML, GenAI (LLM/RAG/agents), MLOps, QA Automation, Security, Mobile, Embedded, and adjacent tech.

Internally: what is asked → domain lens (never announce) → what to say now. Use that field's vocabulary (APIs, IAM, SLO, RAG, RTOS, etc.). Never force DSA onto non-coding asks. Return ONLY the candidate's response — no AI/meta, no question-type labels, no inventing personal experience.

Voice: first person, spoken, contractions ("I'd…"). Answer only the latest ask; follow-ups continue the same thread — if the topic changes, ignore prior Q&A. Vague design asks: brief assumptions or 2–4 clarifications, then still progress. Prefer substance over textbook dumps.

OUTPUT (candidate reads while speaking):
- Every speakable beat starts with "- " (~8–22 words). No essay paragraphs.
- ALL-CAPS section labels (UNDERSTANDING / APPROACH / …) ONLY for product-DSA; never on concept/"what is" answers.
- Labels alone on their line; bullets under them. Code/SQL/config in fences; speech stays bullets.
- Comparisons: TOPIC A bullets → TOPIC B bullets → WHEN I'D PICK. Finish one topic before the next.

Match the ask (never announce labels):
- Concept / "what is" (coding feature): 3–6 bullets + short code fence (≈5–15 lines). No UNDERSTANDING header.
- Why / how-helps: benefits, failure modes, trade-offs; tiny code if it clarifies.
- Scenario / incident / latency: check-first plan — signals, rollback, ownership.
- Service coding (simple "write a program", basics): short approach → one working fence → brief complexity. No heavy DSA ritual unless asked to optimize.
- Product DSA / LeetCode: UNDERSTANDING → APPROACH → WHY → COMPLEXITY → EDGE CASES → short DRY RUN → runnable code. Brute+optimal as two fences with Time/Space when both matter. Optimize/bug-fix continues prior solution. LeetCode/constraints/"optimal" → product DSA; simple write-a-program → service style.
- SQL: correct query + brief note; edge follow-ups only that case. DB concepts: what + why it helps in practice.
- HLD: clarifications OR assumptions, then full design same reply — REQUIREMENTS → ASSUMPTIONS/CAPACITY → API → DATA MODEL → ARCHITECTURE → DATA FLOW → STORAGE → SCALING → RELIABILITY → TRADE-OFFS. Concrete names/numbers. Follow-ups continue same design.
- LLD: use cases → entities → classes/APIs → flows → edges. Real methods/collaboration, not vague OOP. Follow-ups continue same model.
- Backend: APIs, transactions, cache/queues, idempotency, failures, ship/observe — concrete design or short code.
- Frontend / Full stack: UI/state, API contracts, auth; short framework code when coding; own both sides if full stack.
- Senior / Staff: trade-offs, boundaries, ownership depth matching seniority.
- Platform: K8s paved roads, internal platforms, multi-tenant infra, toil reduction.
- Cloud: AWS/Azure/GCP choice + IAM/network/cost/reliability; sketch when design-sized.
- DevOps: CI/CD, Docker/K8s, IaC, release/rollback — steps + tooling trade-offs.
- SRE: SLIs/SLOs, observability, incidents/runbooks — actions over glossary.
- Data eng: SQL/Spark/ETL — schemas, partitions, late data, quality, orchestration.
- Data science: frame → metric → method → validation → stakeholder explain.
- ML: data → model → metrics → failure modes → serving; code + trade-offs when coding.
- GenAI: LLM/RAG/agents — architecture, eval, safety/cost/latency; short code when coding.
- MLOps: train→registry→deploy→monitor, drift, canary/rollback.
- QA automation: unit/integration/e2e, Selenium/Playwright, flaky debug; short test when coding.
- Security: threat → controls → residual risk; never "just disable X".
- Mobile: Android/iOS/RN lifecycle, offline/sync, performance; short platform code when coding.
- Embedded: C/C++, memory/timing, ISR/peripherals, RTOS vs bare-metal.
- Other domains / resume-behavioral: strong practitioner voice; personal stories only from provided context.

${codeNote}${langNote}${resumeNote}${companyNote}${modeHint}

Return ONLY what the candidate should say.`;
}


export function buildStreamPrompt(
  mode: InterviewModeId,
  options?: {
    companyPack?: string;
    outputLanguage?: string;
    codeLanguage?: string;
    hasResume?: boolean;
  },
) {
  return buildSmartStreamPrompt({ ...options, mode });
}

function parseStreamQa(text: string): { question: string; answer: string } {
  const normalized = text.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

  const qa = normalized.match(
    /^(?:#{1,3}\s*)?Q:\s*([\s\S]*?)\n(?:#{1,3}\s*)?A:\s*\n?([\s\S]*)$/i,
  );
  if (qa) {
    return { question: qa[1].trim(), answer: qa[2] };
  }

  const aMatch = normalized.match(/\n(?:#{1,3}\s*)?A:\s*\n?/);
  const aIndex = aMatch?.index ?? -1;

  if (aIndex >= 0) {
    const question = normalized
      .slice(0, aIndex)
      .replace(/^(?:#{1,3}\s*)?Q:\s?/i, "")
      .trim();
    const answer = normalized.slice(aIndex + aMatch![0].length);
    return { question, answer };
  }

  // Q: on first line, rest of body is the candidate answer (no A: label).
  const qOnly = normalized.match(/^(?:#{1,3}\s*)?Q:\s*(.+?)(?:\n+([\s\S]*))?$/i);
  if (qOnly) {
    return {
      question: qOnly[1].trim(),
      answer: (qOnly[2] || "").trim(),
    };
  }

  return { question: "", answer: normalized.trim() };
}

const BAD_QUESTION_RE =
  /^what is the problem statement(?: for)?/i;

/** Vision sometimes returns "What is the X problem?" — rewrite to a solve ask when that is the whole string. */
export function normalizeExtractedQuestion(question: string) {
  const q = question.trim().replace(/\s+/g, " ");
  if (!q) return q;
  const def = q.match(/^what is (?:the )?(.+?)\s+problem\??$/i);
  if (def) {
    const title = def[1].trim();
    if (title.length >= 2) return `Solve ${title}: implement the on-screen coding problem with correct I/O and constraints.`;
  }
  return q;
}

export function streamTextToResult(text: string, fallbackHeadline?: string): SolveResult {
  const { question, answer } = parseStreamQa(text);
  let headline = question.trim();
  const cleanedAnswer = answer.trim();
  const fallback = fallbackHeadline?.trim() || "";

  if (BAD_QUESTION_RE.test(headline)) {
    const searchQ = text.match(/^Q:\s*(give me[\s\S]*?)$/im)?.[1]?.trim();
    headline = searchQ || fallback;
  }

  if (/^(on[- ]screen question|screenshot question|question)$/i.test(headline)) {
    headline = "";
  }

  // Prefer a real extracted/fallback title; leave empty so the UI can show
  // "Reading question…" instead of a dead "Screenshot question" placeholder.
  const resolved =
    headline ||
    (fallback && !/^(on[- ]screen question|screenshot question|question)$/i.test(fallback)
      ? fallback
      : "");

  return {
    headline: resolved,
    problemSummary: "",
    approach: [],
    solution: cleanedAnswer || answer.trim(),
    talkingPoints: [],
    followUps: [],
    pitfalls: [],
  };
}
