/** Split answer text into short speakable visual chunks for live interview reading. */

export type SpeakingChunkKind = "prose" | "bullet" | "example" | "followup" | "gap" | "section";

export type SpeakingChunk = {
  kind: SpeakingChunkKind;
  text: string;
  /** Optional lead-in shown above example body (e.g. "Example") */
  label?: string;
};

/** Interview section label names (DSA / system design / LLD / backend). */
const SECTION_NAMES =
  "UNDERSTANDING|RESTATEMENT|APPROACH|IMPLEMENTATION|SOLUTION|CODE|PSEUDOCODE|WALKTHROUGH|BRUTE\\s*FORCE|OPTIMAL(?:\\s+APPROACH)?|TIME\\s*COMPLEXITY|SPACE\\s*COMPLEXITY|WHY(?:\\s+[A-Z][\\w\\s/+-]{0,40})?|COMPLEXITY|EDGE\\s*CASES?|DRY\\s*RUN|FOLLOW[- ]?UPS?|INTERVIEW\\s+FOLLOW[- ]?UPS?|INTERVIEW\\s+NOTES?|REQUIREMENTS|USE\\s*CASES?|ASSUMPTIONS|CAPACITY|API|APIS|DATA\\s*MODEL|ARCHITECTURE|HIGH[- ]?LEVEL(?:\\s+ARCHITECTURE)?|COMPONENTS|DATA\\s*FLOW|DATABASE|STORAGE|SCALING|SCALABILITY|RELIABILITY|TRADE[- ]?OFFS?|BOTTLENECKS?|CORE\\s*ENTITIES|ENTITIES|CLASSES(?:\\s*&\\s*RESPONSIBILITIES)?|RESPONSIBILITIES|KEY\\s*APIS?(?:\\s*\\/?\\s*METHODS)?|METHODS|RELATIONSHIPS|MAIN\\s*FLOWS?|FLOWS?|EXTENSIONS|DIRECT\\s+ANSWER|EXPLANATION|EXAMPLE|CAVEAT|IMPORTANT\\s+TRADE[- ]?OFF|GOTCHA|WHEN\\s+I(?:'?D| WOULD)\\s+PICK|WHEN\\s+TO\\s+USE|WHEN\\s+I(?:'?D| WOULD)\\s+(?:CHOOSE|USE)|SUMMARY|KEY\\s+DIFFERENCE|KEY\\s+DIFFERENCES";

/** Whole-line heading, optional trailing colon (no body on same line). */
const SECTION_HEADING_ONLY = new RegExp(`^(${SECTION_NAMES})\\s*:?\\s*$`, "i");

/** Heading with body after a required colon. */
const SECTION_HEADING_INLINE = new RegExp(`^(${SECTION_NAMES})\\s*:\\s+(.+)$`, "i");

/** Words that look like sentence openers — never treat as topic headings. */
const TOPIC_OPENER_BLOCK =
  /^(I|I'm|I've|I'd|So|Yes|No|Well|And|But|Or|The|A|An|It|It's|We|We're|You|This|That|Here|There|Also|Then|Next|First|Second|Third|Finally|For|If|When|While|Because|Since|Actually|Basically|Basically,|Okay|Ok|Right|Now|In|On|At|To|With|From|My|Our)\b/i;

const LEGACY_SECTION_LABEL =
  /^(Say first|Theory|Example|Gotcha|When|Follow-up|Why|Time\s*\/\s*space|Time:|Space:|Edges|Voice)\s*:\s*(.*)$/i;

const EXAMPLE_START =
  /^(for example|for instance|say (?:we(?:'re| are)|you|i)|an easy way to think|a simple example|one example|consider (?:this|a)|imagine|take (?:the case|a case)|suppose)\b/i;

const EXAMPLE_LABEL_PREFIX = /^(?:\*{0,2}example\*{0,2}|ex)\s*[:—–-]\s*/i;

const TRANSITION_START =
  /^(first|second|third|finally|next|then|also|after that|on the other hand|by contrast|in contrast|whereas|meanwhile|conversely|the main|another|optimized|brute force|edge case|the (?:main )?lesson|so (?:the|we|i)|that (?:way|allowed|gave|means))\b/i;

/** Leading term used to detect A-vs-B sentences mashed into one paragraph. */
const LEADING_TERM =
  /^(?:[-•*]\s+)?(?:the\s+)?(?:\*\*([^*]+)\*\*|`([^`]+)`|([A-Z][A-Z0-9_]{1,24})\b)/i;

const SENTENCE_RE = /[^.!?]+(?:[.!?]+["']?|$)/g;

const SECTION_DISPLAY: Record<string, string> = {
  understanding: "UNDERSTANDING",
  restatement: "UNDERSTANDING",
  approach: "APPROACH",
  implementation: "IMPLEMENTATION",
  solution: "SOLUTION",
  code: "CODE",
  pseudocode: "PSEUDOCODE",
  walkthrough: "WALKTHROUGH",
  "brute force": "BRUTE FORCE",
  optimal: "OPTIMAL",
  "optimal approach": "OPTIMAL",
  "time complexity": "TIME COMPLEXITY",
  "space complexity": "SPACE COMPLEXITY",
  complexity: "COMPLEXITY",
  "edge cases": "EDGE CASES",
  "edge case": "EDGE CASES",
  "dry run": "DRY RUN",
  "follow-up": "FOLLOW-UP",
  "follow-ups": "FOLLOW-UP",
  followups: "FOLLOW-UP",
  "interview follow-up": "FOLLOW-UP",
  "interview follow-ups": "FOLLOW-UP",
  "interview notes": "FOLLOW-UP",
  requirements: "REQUIREMENTS",
  "use cases": "USE CASES",
  "use case": "USE CASES",
  assumptions: "ASSUMPTIONS",
  capacity: "CAPACITY",
  api: "API",
  apis: "API",
  "data model": "DATA MODEL",
  architecture: "ARCHITECTURE",
  "high-level": "ARCHITECTURE",
  "high-level architecture": "ARCHITECTURE",
  "high level": "ARCHITECTURE",
  "high level architecture": "ARCHITECTURE",
  components: "COMPONENTS",
  "data flow": "DATA FLOW",
  database: "STORAGE",
  storage: "STORAGE",
  scaling: "SCALING",
  scalability: "SCALING",
  reliability: "RELIABILITY",
  "trade-offs": "TRADE-OFFS",
  "trade-off": "TRADE-OFFS",
  tradeoffs: "TRADE-OFFS",
  bottlenecks: "BOTTLENECKS",
  bottleneck: "BOTTLENECKS",
  "core entities": "CORE ENTITIES",
  entities: "CORE ENTITIES",
  classes: "CLASSES",
  "classes & responsibilities": "CLASSES",
  responsibilities: "RESPONSIBILITIES",
  "key apis": "KEY APIS",
  "key api": "KEY APIS",
  "key apis / methods": "KEY APIS",
  "key methods": "KEY APIS",
  methods: "KEY APIS",
  relationships: "RELATIONSHIPS",
  "main flows": "MAIN FLOWS",
  "main flow": "MAIN FLOWS",
  flows: "MAIN FLOWS",
  flow: "MAIN FLOWS",
  extensions: "EXTENSIONS",
  "direct answer": "DIRECT ANSWER",
  explanation: "EXPLANATION",
  example: "EXAMPLE",
  caveat: "CAVEAT",
  "important trade-off": "CAVEAT",
  gotcha: "GOTCHA",
  "when i'd pick": "WHEN I'D PICK",
  "when id pick": "WHEN I'D PICK",
  "when i would pick": "WHEN I'D PICK",
  "when to use": "WHEN TO USE",
  "when i'd choose": "WHEN I'D PICK",
  "when i would choose": "WHEN I'D PICK",
  "when i'd use": "WHEN TO USE",
  "when i would use": "WHEN TO USE",
  summary: "SUMMARY",
  "key difference": "KEY DIFFERENCE",
  "key differences": "KEY DIFFERENCES",
};

/** Detect comparison / topic headings the model puts on their own line (TCP, List, REST…). */
function detectTopicHeading(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || /^[-•*]\s+/.test(trimmed)) return null;

  const boldOnly = trimmed.match(/^\*\*([^*]+)\*\*:?\s*$/);
  if (boldOnly) {
    const label = boldOnly[1].replace(/\s+/g, " ").trim();
    if (label && wordCount(label) <= 6) return label;
  }

  const mdHeading = trimmed.match(/^#{1,6}\s+(.+?)\s*:?\s*$/);
  if (mdHeading) {
    const label = mdHeading[1].replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    if (label && wordCount(label) <= 6) return label;
  }

  // "TCP:" or "REST API:" with no body on the same line
  const titleColon = trimmed.match(/^([A-Za-z0-9][\w+#./\s&'-]{0,40}?):\s*$/);
  if (titleColon) {
    const label = titleColon[1].replace(/\s+/g, " ").trim();
    if (label && wordCount(label) <= 5 && !TOPIC_OPENER_BLOCK.test(label)) {
      return label;
    }
  }

  // Short standalone topic line: LIST / TCP / Hash Map (no sentence punctuation)
  if (
    wordCount(trimmed) <= 4 &&
    trimmed.length <= 36 &&
    !/[.!?…]["']?$/.test(trimmed) &&
    !/[,;:]/.test(trimmed) &&
    !TOPIC_OPENER_BLOCK.test(trimmed) &&
    /^[A-Za-z0-9`]/.test(trimmed)
  ) {
    const cleaned = trimmed.replace(/^`|`$/g, "").replace(/\*\*/g, "").trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    // Every word must look like a title token (ALL CAPS, Title Case, or code-ish) —
    // rejects mid-stream fragments like "Lists over-allocate so".
    const titleish = words.every((word) =>
      /^(?:[A-Z]{2,}|\d+[A-Za-z]?|[A-Z][a-z0-9+#./'-]*|[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)+)$/.test(
        word,
      ),
    );
    if (cleaned && titleish && !SECTION_HEADING_ONLY.test(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

function normalizeSectionLabel(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const key = cleaned.toLowerCase();
  if (SECTION_DISPLAY[key]) return SECTION_DISPLAY[key];
  if (/^why\b/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  return cleaned.toUpperCase();
}

function leadingTerm(sentence: string): string | null {
  const match = sentence.trim().match(LEADING_TERM);
  if (!match) return null;
  return (match[1] || match[2] || match[3] || "").trim().toLowerCase() || null;
}

function wordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const matches = trimmed.match(SENTENCE_RE);
  if (!matches) return [trimmed];
  return matches.map((s) => s.trim()).filter(Boolean);
}

/** Group sentences into short speakable beats (usually 1 sentence / ~8–22 words). */
function chunkSentences(sentences: string[]): string[] {
  if (sentences.length <= 1) return sentences;

  const out: string[] = [];
  let buf: string[] = [];
  let words = 0;

  const flush = () => {
    if (!buf.length) return;
    out.push(buf.join(" ").replace(/\s+/g, " ").trim());
    buf = [];
    words = 0;
  };

  for (const sentence of sentences) {
    const w = wordCount(sentence);
    const wouldBeLong = words + w > 26 && buf.length >= 1;
    const softCap = words >= 18 && buf.length >= 1;
    const hardCap = buf.length >= 2;
    const transitionBreak =
      buf.length >= 1 && TRANSITION_START.test(sentence) && words >= 8;
    const exampleBreak =
      buf.length >= 1 && (EXAMPLE_START.test(sentence) || EXAMPLE_LABEL_PREFIX.test(sentence));

    // "The WHERE … The HAVING …" style — keep each side as its own glanceable line
    const prevTerm = buf.length ? leadingTerm(buf[0]) : null;
    const nextTerm = leadingTerm(sentence);
    const contrastBreak =
      buf.length >= 1 &&
      Boolean(prevTerm && nextTerm && prevTerm !== nextTerm) &&
      words >= 6;

    if (wouldBeLong || softCap || hardCap || transitionBreak || exampleBreak || contrastBreak) {
      flush();
    }

    buf.push(sentence);
    words += w;

    // Prefer ending a beat after a natural close when we already have enough
    if (words >= 12 && buf.length >= 1 && /[.!?]["']?$/.test(sentence)) {
      flush();
    }
  }

  flush();
  return out;
}

function stripExampleLabel(text: string): { label?: string; body: string } {
  const match = text.match(EXAMPLE_LABEL_PREFIX);
  if (match) {
    return { label: "Example", body: text.slice(match[0].length).trim() };
  }
  return { body: text };
}

function isExampleParagraph(text: string) {
  if (EXAMPLE_LABEL_PREFIX.test(text)) return true;
  if (EXAMPLE_START.test(text)) return true;
  return false;
}

function normalizeRawLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""));
}

function expandDenseParagraph(paragraph: string): string[] {
  const trimmed = paragraph.trim();
  if (!trimmed) return [];

  const sentences = splitSentences(trimmed);
  if (sentences.length <= 1) return [trimmed];

  // Contrast pairs ("The WHERE… The HAVING…") must stay as separate glance lines
  // even when the whole block is still under the usual short-paragraph limit.
  if (sentences.length >= 2) {
    const firstTerm = leadingTerm(sentences[0]);
    const hasContrast = sentences.some(
      (sentence, index) =>
        index > 0 &&
        Boolean(firstTerm) &&
        Boolean(leadingTerm(sentence)) &&
        leadingTerm(sentence) !== firstTerm,
    );
    if (hasContrast) {
      return chunkSentences(sentences);
    }
  }

  // Keep short / already-speakable blocks intact
  if (sentences.length <= 1 && wordCount(trimmed) <= 28) {
    return [trimmed];
  }

  if (sentences.length <= 2 && wordCount(trimmed) <= 22) {
    return [trimmed];
  }

  return chunkSentences(sentences);
}

function pushSectionHeading(chunks: SpeakingChunk[], rawLabel: string) {
  const label = normalizeSectionLabel(rawLabel);
  // Avoid duplicate consecutive headings while streaming
  const last = chunks[chunks.length - 1];
  if (last?.kind === "section" && last.label === label) return;
  if (last?.kind === "gap") {
    chunks.pop();
  }
  chunks.push({ kind: "section", text: label, label });
}

/**
 * Turn raw AI answer text into short visual speaking chunks.
 * Preserves intentional blank-line / line breaks; only reflows dense blocks.
 * When streaming, the trailing incomplete line is left unsplit to reduce layout jump.
 */
export function toSpeakingChunks(text: string, streaming = false): SpeakingChunk[] {
  const lines = normalizeRawLines(text);
  const chunks: SpeakingChunk[] = [];

  const pushPiece = (piece: string, forceExample = false) => {
    const trimmed = piece.trim();
    if (!trimmed) return;

    if (forceExample || isExampleParagraph(trimmed)) {
      const { label, body } = stripExampleLabel(trimmed);
      chunks.push({
        kind: "example",
        text: body,
        // Only show chrome label when the source used "Example:" — not for "For example,…"
        label,
      });
      return;
    }

    // Default to bullets so glance-and-speak stays easy even if the model forgot "- ".
    chunks.push({
      kind: "bullet",
      text: trimmed.replace(/^[-•*]\s+/, "").trim(),
    });
  };

  const pushProse = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const headingOnly = trimmed.match(SECTION_HEADING_ONLY);
    const headingInline = headingOnly ? null : trimmed.match(SECTION_HEADING_INLINE);
    const heading = headingOnly ?? headingInline;
    if (heading) {
      const rest = (headingInline?.[2] ?? "").trim();
      pushSectionHeading(chunks, heading[1]);
      if (rest) {
        const labelKey = heading[1].toLowerCase();
        if (/follow[- ]?up|interview\s+notes/.test(labelKey)) {
          chunks.push({
            kind: "followup",
            text: rest.replace(/^["']|["']$/g, ""),
          });
          return;
        }
        if (/^example$/i.test(heading[1])) {
          for (const piece of expandDenseParagraph(rest)) {
            const { body } = stripExampleLabel(piece);
            chunks.push({ kind: "example", text: body, label: "Example" });
          }
          return;
        }
        if (/^[-•*]\s+/.test(rest)) {
          chunks.push({
            kind: "bullet",
            text: rest.replace(/^[-•*]\s+/, "").trim(),
          });
          return;
        }
        for (const piece of expandDenseParagraph(rest)) {
          pushPiece(piece);
        }
      }
      return;
    }

    const topicLabel = detectTopicHeading(trimmed);
    if (topicLabel) {
      pushSectionHeading(chunks, topicLabel);
      return;
    }

    const legacy = trimmed.match(LEGACY_SECTION_LABEL);
    if (legacy) {
      const label = legacy[1].toLowerCase();
      const rest = legacy[2].trim();
      if (label === "follow-up" && rest) {
        chunks.push({
          kind: "followup",
          text: rest.replace(/^["']|["']$/g, ""),
        });
        return;
      }
      if (label === "example" && rest) {
        for (const piece of expandDenseParagraph(rest)) {
          const { body } = stripExampleLabel(piece);
          chunks.push({ kind: "example", text: body, label: "Example" });
        }
        return;
      }
      if (rest) {
        for (const piece of expandDenseParagraph(rest)) {
          pushPiece(piece);
        }
      }
      return;
    }

    if (/^[-•*]\s+/.test(trimmed)) {
      chunks.push({
        kind: "bullet",
        text: trimmed.replace(/^[-•*]\s+/, "").trim(),
      });
      return;
    }

    const forceExample = EXAMPLE_LABEL_PREFIX.test(trimmed);
    for (const piece of expandDenseParagraph(trimmed)) {
      pushPiece(piece, forceExample);
    }
  };

  // Group consecutive non-empty lines; blank lines become gaps between beats.
  // Single newlines already act as speaking breaks (matches generation prompt).
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].trim()) {
      // Collapse runs of blank lines into at most one visual gap
      if (chunks.length && chunks[chunks.length - 1].kind !== "gap") {
        chunks.push({ kind: "gap", text: "" });
      }
      while (i < lines.length && !lines[i].trim()) i += 1;
      continue;
    }

    const line = lines[i];
    const isLastLine = i === lines.length - 1;
    const leaveUnsplit = streaming && isLastLine && !/[.!?…]["']?\s*$/.test(line.trim());

    if (leaveUnsplit) {
      // Trailing incomplete stream token — show as-is without reflow
      const trimmed = line.trim();
      if (trimmed) {
        const heading = trimmed.match(SECTION_HEADING_ONLY);
        const topic = heading ? null : detectTopicHeading(trimmed);
        if (heading) {
          pushSectionHeading(chunks, heading[1]);
        } else if (topic) {
          pushSectionHeading(chunks, topic);
        } else if (/^[-•*]\s+/.test(trimmed)) {
          chunks.push({
            kind: "bullet",
            text: trimmed.replace(/^[-•*]\s+/, "").trim(),
          });
        } else if (isExampleParagraph(trimmed)) {
          const { label, body } = stripExampleLabel(trimmed);
          chunks.push({ kind: "example", text: body, label });
        } else {
          chunks.push({
            kind: "bullet",
            text: trimmed.replace(/^[-•*]\s+/, "").trim(),
          });
        }
      }
      i += 1;
      continue;
    }

    pushProse(line);
    i += 1;
  }

  // Drop leading/trailing gaps
  while (chunks.length && chunks[0].kind === "gap") chunks.shift();
  while (chunks.length && chunks[chunks.length - 1].kind === "gap") chunks.pop();

  return chunks;
}
