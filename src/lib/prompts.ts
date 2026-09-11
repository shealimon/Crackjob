import type { InterviewModeId } from "@/lib/constants";
import { INTERVIEW_MODES, PRODUCT_COMPANIES, SERVICE_COMPANIES } from "@/lib/constants";
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
export function extractResumeAnchors(resumeText: string) {
  const summary = analyzeResumeExperience(resumeText);
  return buildCareerAnchorLines(summary).join("\n");
}

export function questionNeedsResume(question: string): boolean {
  return /tell me about yourself|about yourself|your (background|experience|resume|career|journey)|walk me through|why should we hire|why (are you|do you want)|why.*(change|leave|looking)|biggest achievement|proudest|challenging project|difficult problem|current (role|project|position)|previous (role|project|company)|leadership experience|describe a time|tell me about a time|your (strengths|skills|weakness)|what did you do at|what was your role|years of experience|professional experience|conflict|difficult stakeholder|made a mistake|failure/i.test(
    question,
  );
}

export function formatResumeContext(resumeText: string) {
  const trimmed = resumeText.trim();
  if (!trimmed) return "";
  const anchors = extractResumeAnchors(trimmed);
  return `${anchors}\n\nFULL RESUME TEXT:\n${trimmed}`;
}

/** Screenshot vision uses the same answer engine as audio (see buildSmartStreamPrompt). */
export function buildScreenshotStreamPrompt(codeLanguage?: string) {
  return buildSmartStreamPrompt({
    fromScreenshot: true,
    codeLanguage,
  });
}

/** System prompt for audio / pasted-text / screenshot answers. */
export function buildSmartStreamPrompt(options?: {
  companyPack?: string;
  outputLanguage?: string;
  codeLanguage?: string;
  answerOnly?: boolean;
  fromScreenshot?: boolean;
  hasResume?: boolean;
  resumeText?: string;
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
    ? `\nA resume is provided in the user message when relevant. For personal, project, or behavioral questions, answer ONLY from that resume — never invent employers, projects, metrics, or stories.`
    : `\nIf no resume is provided for personal/project/behavioral asks, answer in general first-person interview style without inventing specific employers, projects, or metrics.`;

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

  const screenshotRule = options?.fromScreenshot
    ? `

Screenshot answers — first line is mandatory:
Q: <short label of the visible on-screen question>
Then the candidate response on the following lines. Never use placeholders like "On-screen question".`
    : "";

  return `You are a real-time interview response engine for any professional domain — software engineering, DevOps, cloud, security, testing/QA, data science, AI/ML, backend, frontend, mobile, product, and adjacent tech roles. Candidates from any field may use this.

For every interviewer input, internally identify:

1. What is being asked.
2. What the interviewer expects.
3. What the candidate should say or provide at that exact moment.

Identify the relevant interview type, subject, domain vocabulary, and response style yourself from the question and context. Do not limit yourself to any predefined list. Use that domain's natural terms (e.g. pipelines, IAM, p-values, confusion matrix, CVE, SLO) — never force a DSA/coding template onto a non-coding ask.

Return ONLY the complete response the candidate should give.${screenshotRule}

Respond specifically to the question and the ongoing interview context. Do not give generic textbook, documentation, Wikipedia, or internet-style answers.

Choose the appropriate response naturally based on the question and the current stage of the interview. For vague asks with missing critical constraints, state sensible assumptions briefly (or ask 2–4 sharp clarifying questions) and then still progress the answer — do not stop after clarifications alone when the interviewer clearly wants a design or solution.

The response may include an explanation, reasoning, example, code, SQL/query, config snippet, calculation, clarification question, design discussion, decision, runbook step, experiment plan, or other supporting content when appropriate. Decide yourself what is needed at that moment.

Use previous conversation context when available. Treat the interview as an ongoing conversation. For follow-ups (other approach, optimize, edge case, complexity, "what if", same problem, scale numbers, add feature), respond only to what is needed next — do not restart or repeat the prior solution. If asked for another approach, give a genuinely different valid approach with supporting code when coding.

Make every response technically correct, relevant, simple, natural, and easy to speak and explain. Use conversational language, short clear sentences, and only the depth the question requires.

Speak like a real candidate in a live interview: first person, calm, and human — brief thinking aloud is fine ("so the main idea is…"), then the substance. Prefer flowing speech over bullet-essay tone, numbered lecture style, or robotic section dumps unless the round clearly needs a structured whiteboard (product DSA / HLD / LLD).

Answer ONLY the latest interviewer question. If prior Q&A is present but the new ask is a different topic, ignore the prior thread completely — never reopen or paraphrase the previous answer.

Do not unnecessarily complicate simple questions. Avoid unnecessary jargon, repetition, and filler.

Never invent candidate experience or personal information.

The response should sound like a strong candidate speaking naturally to an interviewer, not like an AI, article, documentation, or memorized answer.

Do not mention the question type, interviewer intent, analysis, instructions, or that you are an AI.

Quality bar — match the ask (never announce these labels out loud):
- Basic / conceptual / "what is": simple spoken explanation + one practical example from that domain.
- "Why" questions: answer the real interviewer why (benefits, failure modes, trade-offs) — not a definition dump.
- Comparison / A vs B: crisp contrast + when you would choose each.
- Scenario / debugging / incident / outage / latency / traffic spike: stepwise investigation or action plan; prioritize what to check first; mention signals, rollback, and ownership when relevant.
- Practical "how does X help": clear mechanism + real technical example.
- Service-based / normal coding (TCS, Infosys, Wipro, Cognizant, Accenture style; simple "write a program", string/array basics, pattern, factorial, reverse, CRUD-ish logic):
  Interviewer mainly wants a correct working solution they can follow. Keep it light:
  short restatement → plain approach in 2–4 sentences → one clean working code fence → brief complexity or edge note if useful.
  Do NOT force a heavy product-DSA ritual (long UNDERSTANDING/WHY/DRY RUN theater, dual brute+optimal essays) unless they explicitly ask for optimization or another approach.
  Sound practical and calm — "here's how I'd write it" — not like a FAANG whiteboard performance.
- Product-based DSA / LeetCode / hard coding (FAANG/product companies; Two Sum, trees, graphs, DP, sliding window, "optimize this", medium/hard constraints):
  Interviewer expects HOW a strong candidate handles a DSA problem end-to-end. Use the full speakable process:
  UNDERSTANDING (inputs/outputs/constraints, 1–2 clarifying assumptions) → APPROACH (start with brute if useful, then optimal idea) → WHY it works → COMPLEXITY → EDGE CASES → short DRY RUN → FOLLOW-UP cue if natural → correct runnable code.
  When brute vs optimal both matter, show TWO fences (brute then optimized), each with Time/Space. Optimal speech must match the optimized code.
  If they ask to optimize after nested loops, only improve from the prior solution — do not restart. If they ask to find a bug, name the bug, explain why, and show the fixed code.
  Detect from the question itself when mode is unset: named LeetCode-style problems, asymptotic constraints, or "optimal/efficient" → product DSA style; simple "write a program to…" basics → service coding style.
- SQL / analytics queries: correct query + brief explanation. On edge-case follow-ups (ties, nulls, duplicates), address only that case.
- Database concepts: what it is + why it improves performance in practice.
- HLD / system design ("Design a URL shortener", news feed, chat, rate limiter, etc.):
  Do NOT answer with only clarifying questions. Open with 2–4 sharp clarifications OR state explicit assumptions (scale, read/write, consistency, clients), then deliver a complete first-pass design in the SAME response.
  Prefer speakable sections in order:
  REQUIREMENTS (functional + non-functional) → ASSUMPTIONS / CAPACITY (QPS, storage back-of-envelope) → API → DATA MODEL → ARCHITECTURE / COMPONENTS → DATA FLOW → STORAGE → SCALING → RELIABILITY → TRADE-OFFS.
  Be concrete: name services, caches, queues, DBs, and why. Give rough numbers. Call out bottlenecks and alternatives. Sound like a strong staff/senior candidate whiteboard talk — not a blog outline.
  Follow-ups (add analytics, only create+redirect, 10x traffic, multi-region): continue the SAME design — do not restart from requirements unless asked.
- LLD / object design / machine coding ("Design a parking lot", elevator, chess, logger, bookmyshow core):
  Do NOT stop at vague OOP theory. Open with brief use cases + constraints, then a real object design.
  Prefer speakable sections:
  REQUIREMENTS / USE CASES → CORE ENTITIES → CLASSES & RESPONSIBILITIES → KEY APIs / METHODS → RELATIONSHIPS → MAIN FLOWS → EDGE CASES → EXTENSIONS.
  Include class names, important fields, method signatures, and how objects collaborate. Add short pseudocode or a fenced sketch for the hottest path when it helps. Interactive and concrete — not a UML dump without behavior.
  Follow-ups continue the same class model.
- DevOps / SRE / platform: CI/CD, infra-as-code, containers/orchestration, observability, SLIs/SLOs, incident response — speakable steps, real tooling trade-offs, and what you'd automate vs do manually.
- Cloud (AWS/GCP/Azure/multi-cloud): service choice with why, networking/IAM/cost/reliability angle, and a concrete architecture sketch when the ask is design-sized; state assumptions then design.
- Security: threat model → controls → residual risk; cover authn/authz, secrets, network, logging, and compliance lightly when relevant; never invent insecure "just disable X" shortcuts.
- Testing / QA: test strategy (unit/integration/e2e), what you'd automate, edge cases, and how you'd debug a failing suite or flaky test — practical, not a glossary dump.
- Data science / analytics: problem framing → metric/hypothesis → method → validation/leakage checks → how you'd explain results to stakeholders; include a tiny example or sketch when it clarifies.
- AI / ML: problem → data → model/approach → evaluation metrics → failure modes (bias, drift, latency/cost) → deployment/monitoring when relevant; for ML coding, give correct code plus complexity/trade-offs like other coding asks.
- Any other domain: mirror a strong practitioner in that field — correct substance, speakable structure, example or decision trade-off, and follow-ups that continue the same thread.
- Project / resume / behavioral: first-person, natural, and grounded in provided context only. Follow-ups continue the same story with reflection when asked.

${codeNote}${langNote}${resumeNote}${companyNote}${modeHint}

Return ONLY what the candidate should say.`;
}

/** Compact system prompt for every API call. */
export function buildCompactStreamPrompt(
  mode: InterviewModeId,
  options?: {
    companyPack?: string;
    outputLanguage?: string;
    codeLanguage?: string;
    answerOnly?: boolean;
    fromScreenshot?: boolean;
    hasResume?: boolean;
    resumeText?: string;
  },
) {
  return buildSmartStreamPrompt({ ...options, mode });
}

export function buildStreamPrompt(
  mode: InterviewModeId,
  options?: {
    companyPack?: string;
    outputLanguage?: string;
    codeLanguage?: string;
    answerOnly?: boolean;
    fromScreenshot?: boolean;
  },
) {
  return buildCompactStreamPrompt(mode, options);
}

export function parseStreamQa(text: string): { question: string; answer: string } {
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

const DEMO_FUNDAMENTALS = `A list can change in place; a tuple can't. That one fact drives where I'd use each.

Lists over-allocate so append stays cheap — amortized O(1). Tuples are fixed-size, smaller, and only a tuple of hashable items can be a dict key.

\`\`\`python
coords = (28.6, 77.2)          # fixed record
cart = ["milk", "eggs"]        # grows / edits
cart.append("bread")

# print({coords: "Delhi"})     # works — tuple is hashable
# print({cart: "order"})       # TypeError — list is unhashable
print(cart)
\`\`\`

That prints \`['milk', 'eggs', 'bread']\`. I'd return \`coords\` from an API; I'd keep \`cart\` as a list.

Gotcha — immutability is shallow: a tuple's slots can't change, but an inner list still can. For a hashable key, nest tuples, not lists.`;

export function demoSolve(mode: InterviewModeId): SolveResult {
  const meta = INTERVIEW_MODES.find((item) => item.id === mode);
  return {
    headline: `Demo ${meta?.label ?? mode} question`,
    problemSummary: "",
    approach: [],
    solution:
      mode === "dsa" || mode === "oa"
        ? "UNDERSTANDING\nSo we're given two linked lists where each node is a digit and the lists represent numbers in reverse — like 2→4→3 means 342. I need to return the sum as the same kind of list.\n\nAPPROACH\nI'd walk both lists in one pass with a **carry**, building the result as I go.\n\nUse a dummy head so I never special-case the first node. While either list has nodes or carry remains, add digits, write the new digit, and advance.\n\nBuilding full integers first is the slow/fragile brute force — digit-by-digit is cleaner.\n\nWHY ONE PASS\nEach node is visited once. Carry handles overflow without converting to big integers.\n\nCOMPLEXITY\n- Time O(max(m,n)) — one pass over both lists\n- Space O(1) — only carry and pointers (output not counted)\n\nEDGE CASES\n- Different list lengths\n- Final carry left after both lists end\n- Empty lists\n\nDRY RUN\n2→4→3 + 5→6→4 → 7→0→8 (342 + 465 = 807)\n\nFOLLOW-UP\nIf digits were stored forward, I'd reverse first or use stacks — same carry logic.\n\n```python\nclass ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef addTwoNumbersBrute(l1, l2):\n    def to_int(node):\n        n, p = 0, 1\n        while node:\n            n += node.val * p\n            p *= 10\n            node = node.next\n        return n\n    def to_list(n):\n        dummy = ListNode(0)\n        curr = dummy\n        while n:\n            n, d = divmod(n, 10)\n            curr.next = ListNode(d)\n            curr = curr.next\n        return dummy.next\n    return to_list(to_int(l1) + to_int(l2))\n```\nTime: O(max(m,n)) — walk each list once to build integers\nSpace: O(max(m,n)) — store full converted numbers and output list\n\n```python\ndef addTwoNumbers(l1, l2):\n    dummy = ListNode(0)\n    curr = dummy\n    carry = 0\n    while l1 or l2 or carry:\n        a = l1.val if l1 else 0\n        b = l2.val if l2 else 0\n        total = a + b + carry\n        carry, digit = divmod(total, 10)\n        curr.next = ListNode(digit)\n        curr = curr.next\n        l1 = l1.next if l1 else None\n        l2 = l2.next if l2 else None\n    return dummy.next\n```\nTime: O(max(m,n)) — one pass, constant work per node\nSpace: O(1) — only carry and pointers, output not counted"
        : DEMO_FUNDAMENTALS,
    talkingPoints: [],
    followUps: [],
    pitfalls: [],
  };
}
