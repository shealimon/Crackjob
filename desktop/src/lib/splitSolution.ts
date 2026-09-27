export type CodeBlock = {
  title: string;
  code: string;
  language: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  timeWhy?: string;
  spaceWhy?: string;
};

export type SplitSolution = {
  prose: string;
  codeBlocks: CodeBlock[];
  /** All code joined — backward compatible */
  code: string;
  language: string;
};

const FENCE_RE = /```([a-zA-Z0-9_+-]*)[ \t]*\r?\n([\s\S]*?)```/g;
const OPEN_FENCE_RE = /```([a-zA-Z0-9_+-]*)[ \t]*\r?\n([\s\S]*)$/;
const SECTION_RE =
  /^(Say first|Theory|Example|Gotcha|When|Follow-up|Why|Time\s*\/\s*space|Time:|Space:|Edges|Voice|UNDERSTANDING|RESTATEMENT|APPROACH|COMPLEXITY|EDGE\s*CASES?|DRY\s*RUN|FOLLOW[- ]?UPS?|REQUIREMENTS|USE\s*CASES?|ASSUMPTIONS|CAPACITY|API|APIS|DATA\s*MODEL|ARCHITECTURE|COMPONENTS|DATA\s*FLOW|STORAGE|SCALING|RELIABILITY|TRADE[- ]?OFFS?|BOTTLENECKS?|CORE\s*ENTITIES|ENTITIES|CLASSES|RESPONSIBILITIES|KEY\s*APIS?|METHODS|RELATIONSHIPS|MAIN\s*FLOWS?|EXTENSIONS|DIRECT\s+ANSWER|EXPLANATION|CAVEAT)\s*:?/i;
const CODE_START_RE =
  /^(def |class |function |async function |export |import |from |public |private |protected |#include|using |package |fn |func |interface |struct |enum |void |int main|print\(|input\(|n = int|num = |if __name__|const \w|let \w|var \w)/;
const TIME_LABEL = "Time(?:\\s+complexity)?";
const SPACE_LABEL = "Space(?:\\s+complexity)?";
/** Optional spoken filler: "here", "for this", "of this approach", etc. */
const LABEL_FILLER =
  "(?:\\s+(?:here|there|(?:for|of)\\s+this(?:\\s+(?:approach|solution|version|method|one|code))?))?";
const LABEL_SEP = `(?:${LABEL_FILLER}\\s+is|\\s*[:\\—\\-]\\s*)`;
const BIG_O_CAPTURE = "((?:O|Θ|Ω)\\s*[\\(\\[][^)\\]]+[)\\]])";
const WHY_CAPTURE = "(?:\\s*(?:[—\\-–]|because(?:\\s+of)?)\\s*([^\\n.,]+))?";
const COMPLEXITY_LINE_RE = new RegExp(
  `^${TIME_LABEL}${LABEL_SEP}(.+?)(?:\\s*[,·|\\/]\\s*${SPACE_LABEL}${LABEL_SEP}(.+?))?\\s*$`,
  "i",
);
const TIME_LINE_RE = new RegExp(`^${TIME_LABEL}${LABEL_SEP}(.+)$`, "i");
const SPACE_LINE_RE = new RegExp(`^${SPACE_LABEL}${LABEL_SEP}(.+)$`, "i");
const BIG_O_RE = /^((?:O|Θ|Ω)\s*[\(\[][^)\]]+[)\]])/i;

function looksLikeCode(line: string) {
  return CODE_START_RE.test(line.trimStart());
}

function trimBlank(lines: string[]) {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
}

/** Overlay labels brute/optimized only for a real DSA pair — not concept examples. */
function looksLikeAlgorithm(code: string) {
  return /\breturn\b/.test(code) && /\b(for|while)\b/.test(code);
}

function looksLikeDsaPair(
  blocks: Array<{ timeComplexity?: string; spaceComplexity?: string; code: string }>,
  surroundingText: string,
) {
  if (blocks.length !== 2) return false;
  if (blocks.some((block) => block.timeComplexity || block.spaceComplexity)) return true;
  if (looksLikeAlgorithm(blocks[0].code) && looksLikeAlgorithm(blocks[1].code)) return true;
  return /\b(brute\s*force|naive (?:approach|solution|way)|optimized|better (?:approach|solution))\b/i.test(
    surroundingText,
  );
}

function applyBlockTitles(blocks: CodeBlock[], surroundingText: string) {
  if (!looksLikeDsaPair(blocks, surroundingText)) return;
  blocks[0].title = "Brute force";
  blocks[1].title = "Optimized";
}

/** Concept answers sometimes split classes vs usage into two fences — show as one example. */
function mergeConceptualFences(blocks: CodeBlock[]): CodeBlock[] {
  if (blocks.length !== 2) return blocks;
  if (blocks[0].title || blocks[1].title) return blocks;
  if (blocks.some((block) => block.timeComplexity || block.spaceComplexity)) return blocks;
  if (looksLikeAlgorithm(blocks[0].code) && looksLikeAlgorithm(blocks[1].code)) return blocks;
  const langA = (blocks[0].language || "").toLowerCase();
  const langB = (blocks[1].language || "").toLowerCase();
  if (langA && langB && langA !== langB) return blocks;
  return [
    {
      title: "",
      code: `${blocks[0].code}\n\n${blocks[1].code}`,
      language: blocks[0].language || blocks[1].language,
    },
  ];
}

function looksLikeComplexityValue(value: string) {
  const trimmed = value.trim();
  return BIG_O_RE.test(trimmed);
}

function cleanWhy(why: string | undefined) {
  if (!why) return undefined;
  return why
    .trim()
    .replace(/^(?:because\s+)/i, "")
    .replace(/[.,;:\s]+$/, "")
    .trim() || undefined;
}

function splitComplexityPart(raw: string): { value?: string; why?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  const withWhy = trimmed.match(
    /^((?:O|Θ|Ω)\s*[\(\[][^)\]]+[)\]])\s*(?:[—\-–]|because(?:\s+of)?)\s*(.+)$/i,
  );
  if (withWhy) {
    return { value: withWhy[1].trim(), why: cleanWhy(withWhy[2]) };
  }

  const bigOOnly = trimmed.match(BIG_O_RE);
  if (bigOOnly) {
    const rest = trimmed.slice(bigOOnly[0].length).trim();
    const because = rest.match(/^because\s+(.+)$/i);
    if (because) {
      return { value: bigOOnly[1].trim(), why: cleanWhy(because[1]) };
    }
    return { value: bigOOnly[1].trim() };
  }

  return { value: trimmed };
}

function parseCombinedComplexityLine(line: string): {
  time?: string;
  space?: string;
  timeWhy?: string;
  spaceWhy?: string;
} {
  const combined = line.match(COMPLEXITY_LINE_RE);
  if (!combined || !looksLikeComplexityValue(combined[1])) return {};

  const timePart = splitComplexityPart(combined[1]);
  const spacePart = combined[2] ? splitComplexityPart(combined[2]) : {};

  return {
    time: timePart.value,
    timeWhy: timePart.why,
    space: spacePart.value,
    spaceWhy: spacePart.why,
  };
}

export function parseComplexitySuffix(text: string): {
  time?: string;
  space?: string;
  timeWhy?: string;
  spaceWhy?: string;
  consumed: number;
} {
  const leading = text.match(/^\s*/)?.[0]?.length ?? 0;
  const remaining = text.slice(leading);
  if (!remaining) return { consumed: 0 };

  const lines = remaining.split("\n");
  let time: string | undefined;
  let space: string | undefined;
  let timeWhy: string | undefined;
  let spaceWhy: string | undefined;
  let lineOffset = 0;

  for (let i = 0; i < Math.min(lines.length, 3); i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) {
      lineOffset += rawLine.length + 1;
      continue;
    }

    const combined = parseCombinedComplexityLine(trimmed);
    if (combined.time || combined.space) {
      time = combined.time ?? time;
      space = combined.space ?? space;
      timeWhy = combined.timeWhy ?? timeWhy;
      spaceWhy = combined.spaceWhy ?? spaceWhy;
      lineOffset += rawLine.length + 1;
      if (combined.space) {
        return { time, space, timeWhy, spaceWhy, consumed: leading + lineOffset };
      }
      continue;
    }

    const timeMatch = trimmed.match(TIME_LINE_RE);
    if (timeMatch) {
      const part = splitComplexityPart(timeMatch[1]);
      if (part.value && (looksLikeComplexityValue(part.value) || BIG_O_RE.test(part.value))) {
        time = part.value;
        timeWhy = part.why;
        lineOffset += rawLine.length + 1;
        continue;
      }
    }

    const spaceMatch = trimmed.match(SPACE_LINE_RE);
    if (spaceMatch) {
      const part = splitComplexityPart(spaceMatch[1]);
      if (part.value && (looksLikeComplexityValue(part.value) || BIG_O_RE.test(part.value))) {
        space = part.value;
        spaceWhy = part.why;
        lineOffset += rawLine.length + 1;
        continue;
      }
    }

    break;
  }

  if (time || space) {
    return { time, space, timeWhy, spaceWhy, consumed: leading + lineOffset };
  }
  return { consumed: 0 };
}

function findComplexityMention(text: string, kind: "time" | "space") {
  const label = kind === "time" ? TIME_LABEL : SPACE_LABEL;
  const re = new RegExp(`${label}${LABEL_SEP}\\s*${BIG_O_CAPTURE}${WHY_CAPTURE}`, "gi");
  let last: { value: string; why?: string } | undefined;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    last = {
      value: match[1].trim(),
      why: cleanWhy(match[2]),
    };
  }
  return last;
}

function parseComplexityInline(text: string): {
  time?: string;
  space?: string;
  timeWhy?: string;
  spaceWhy?: string;
} {
  const time = findComplexityMention(text, "time");
  const space = findComplexityMention(text, "space");
  return {
    time: time?.value,
    timeWhy: time?.why,
    space: space?.value,
    spaceWhy: space?.why,
  };
}

function parseComplexityForBlock(proseBefore: string, afterFence: string): {
  time?: string;
  space?: string;
  timeWhy?: string;
  spaceWhy?: string;
  consumed: number;
} {
  const suffix = parseComplexitySuffix(afterFence);
  if (suffix.time && suffix.space) return suffix;

  const inlineBefore = parseComplexityInline(proseBefore.slice(-600));

  return {
    time: suffix.time ?? inlineBefore.time,
    space: suffix.space ?? inlineBefore.space,
    timeWhy: suffix.timeWhy ?? inlineBefore.timeWhy,
    spaceWhy: suffix.spaceWhy ?? inlineBefore.spaceWhy,
    consumed: suffix.consumed,
  };
}

function stripComplexityLinesFromProse(prose: string) {
  return prose
    .split("\n")
    .map((line) => {
      // Keep COMPLEXITY / edge-case bullets intact (e.g. "- Time O(n) — …")
      if (/^\s*[-•*]\s+/.test(line)) return line;
      return line
        .replace(
          new RegExp(
            `^\\s*${TIME_LABEL}${LABEL_SEP}(?:O|Θ|Ω)[^\\n]+(?:\\s*[,·|\\/]\\s*${SPACE_LABEL}${LABEL_SEP}(?:O|Θ|Ω)[^\\n]+)?\\s*$`,
            "i",
          ),
          "",
        )
        .replace(new RegExp(`^\\s*${SPACE_LABEL}${LABEL_SEP}(?:O|Θ|Ω)[^\\n]+\\s*$`, "i"), "")
        .replace(
          new RegExp(
            `(?:${TIME_LABEL}|${SPACE_LABEL})${LABEL_SEP}\\s*${BIG_O_CAPTURE}${WHY_CAPTURE}`,
            "gi",
          ),
          "",
        );
    })
    .join("\n")
    // Spoken leftovers after pulling time/space out of mid-sentence prose
    .replace(/,?\s*and\s*\./gi, ".")
    .replace(/\.\s*\./g, ".")
    .replace(/,\s*$/gim, "")
    .replace(/\band\s*$/gim, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitUnfenced(text: string): SplitSolution | null {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i += 1;
  if (i >= lines.length || !looksLikeCode(lines[i])) return null;

  let end = lines.length;
  for (let j = i + 1; j < lines.length; j += 1) {
    const line = lines[j];
    if (!line.startsWith(" ") && !line.startsWith("\t") && SECTION_RE.test(line.trim())) {
      end = j;
      break;
    }
  }

  const codeLines = trimBlank(lines.slice(i, end));
  if (codeLines.filter((line) => line.trim()).length < 2) return null;

  const code = codeLines.join("\n");
  const beforeCode = trimBlank(lines.slice(0, i)).join("\n").trim();
  const afterCode = lines.slice(end).join("\n");
  const { time, space, timeWhy, spaceWhy } = parseComplexityForBlock(beforeCode, afterCode);
  const block: CodeBlock = {
    title: "",
    code,
    language: "",
    timeComplexity: time,
    spaceComplexity: space,
    timeWhy,
    spaceWhy,
  };
  return {
    prose: stripComplexityLinesFromProse(trimBlank(lines.slice(end)).join("\n").trim()),
    codeBlocks: [block],
    code,
    language: "",
  };
}

export function splitSolution(solution: string): SplitSolution {
  const text = solution.replace(/\r\n/g, "\n");
  const fences = [...text.matchAll(FENCE_RE)];
  if (fences.length) {
    const codeBlocks: CodeBlock[] = [];
    let cursor = 0;
    fences.forEach((fence, index) => {
      const proseBefore = text.slice(cursor, fence.index ?? cursor);
      const code = fence[2].trim();
      const fenceEnd = (fence.index ?? 0) + fence[0].length;
      const nextFenceStart = fences[index + 1]?.index ?? text.length;
      const afterFence = text.slice(fenceEnd, nextFenceStart);
      const { time, space, timeWhy, spaceWhy } = parseComplexityForBlock(proseBefore, afterFence);

      if (code) {
        codeBlocks.push({
          title: "",
          code,
          language: fence[1]?.trim() || "",
          timeComplexity: time,
          spaceComplexity: space,
          timeWhy,
          spaceWhy,
        });
      }
      cursor = fenceEnd;
    });

    if (codeBlocks.length) {
      applyBlockTitles(codeBlocks, text);
      const displayBlocks = mergeConceptualFences(codeBlocks);
      let prose = text;
      for (let i = fences.length - 1; i >= 0; i -= 1) {
        const fence = fences[i];
        const fenceStart = fence.index ?? 0;
        const fenceEnd = fenceStart + fence[0].length;
        const nextFenceStart = fences[i + 1]?.index ?? text.length;
        const afterFence = text.slice(fenceEnd, nextFenceStart);
        const { consumed } = parseComplexitySuffix(afterFence);
        prose = prose.slice(0, fenceStart) + prose.slice(fenceEnd + consumed);
      }
      prose = stripComplexityLinesFromProse(prose.replace(/\n{3,}/g, "\n\n").trim());
      const language =
        displayBlocks.find((block) => block.language)?.language || displayBlocks[0].language || "";
      const code = displayBlocks.map((block) => block.code).join("\n\n");
      return { prose, codeBlocks: displayBlocks, code, language };
    }
  }

  const open = text.match(OPEN_FENCE_RE);
  if (open && !text.slice(open.index ?? 0).includes("```", 3)) {
    const proseBefore = text.slice(0, open.index).trim();
    const code = open[2].replace(/\n+$/, "");
    const afterOpen = text.slice((open.index ?? 0) + open[0].length);
    const { time, space, timeWhy, spaceWhy } = parseComplexityForBlock(proseBefore, afterOpen);
    const block: CodeBlock = {
      title: "",
      code,
      language: open[1] || "",
      timeComplexity: time,
      spaceComplexity: space,
      timeWhy,
      spaceWhy,
    };
    return {
      prose: proseBefore,
      codeBlocks: [block],
      code,
      language: block.language,
    };
  }

  return (
    splitUnfenced(text) ?? {
      prose: text.trim(),
      codeBlocks: [],
      code: "",
      language: "",
    }
  );
}
