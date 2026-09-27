const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export type CareerSummary = {
  explicitTotalYears: number | null;
  explicitPlus: boolean;
  computedTotalYears: number | null;
  employmentEntries: string[];
  yearsLabel: string | null;
  shouldMentionYears: boolean;
};

type MonthPoint = { year: number; month: number };

function parseMonthName(token: string): number {
  const key = token.toLowerCase().replace(/\./g, "").trim();
  return MONTH_MAP[key] ?? 1;
}

function toMonthPoint(year: number, month = 1): MonthPoint {
  return { year, month: Math.min(12, Math.max(1, month)) };
}

function monthIndex(point: MonthPoint) {
  return point.year * 12 + point.month;
}

function parseYearToken(token: string, fallbackCentury = 2000): number | null {
  const cleaned = token.trim();
  if (/^\d{4}$/.test(cleaned)) return Number.parseInt(cleaned, 10);
  if (/^\d{2}$/.test(cleaned)) {
    const yy = Number.parseInt(cleaned, 10);
    return yy >= 70 ? 1900 + yy : fallbackCentury + yy;
  }
  return null;
}

function parseDateToken(token: string): MonthPoint | null {
  const cleaned = token.trim();
  if (/^(present|current|now|till date|to date)$/i.test(cleaned)) {
    const now = new Date();
    return toMonthPoint(now.getFullYear(), now.getMonth() + 1);
  }

  const named = cleaned.match(
    /^([A-Za-z]+)\.?\s*[,/-]?\s*(\d{4}|\d{2})$/i,
  );
  if (named) {
    const year = parseYearToken(named[2]);
    if (!year) return null;
    return toMonthPoint(year, parseMonthName(named[1]));
  }

  const mmYyyy = cleaned.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (mmYyyy) {
    return toMonthPoint(Number.parseInt(mmYyyy[2], 10), Number.parseInt(mmYyyy[1], 10));
  }

  const yyyyMm = cleaned.match(/^(\d{4})[/.-](\d{1,2})$/);
  if (yyyyMm) {
    return toMonthPoint(Number.parseInt(yyyyMm[1], 10), Number.parseInt(yyyyMm[2], 10));
  }

  const yearOnly = parseYearToken(cleaned);
  if (yearOnly) return toMonthPoint(yearOnly, 1);

  return null;
}

function mergeRanges(ranges: Array<{ start: MonthPoint; end: MonthPoint }>) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => monthIndex(a.start) - monthIndex(b.start));
  const merged: Array<{ start: MonthPoint; end: MonthPoint }> = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (monthIndex(current.start) <= monthIndex(last.end) + 1) {
      if (monthIndex(current.end) > monthIndex(last.end)) {
        last.end = current.end;
      }
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function monthsToYearsLabel(totalMonths: number): { years: number; plus: boolean } {
  const years = Math.floor(totalMonths / 12);
  const remainder = totalMonths % 12;
  return { years: Math.max(1, years), plus: remainder >= 6 || years >= 10 };
}

function extractExplicitTotalYears(text: string) {
  let best: { years: number; plus: boolean } | null = null;
  const patterns = [
    /(\d{1,2})\+\s*(?:years?|yrs?)(?:\s+of)?\s*(?:experience|exp\.?)/gi,
    /(?:total|overall|professional|work)\s*(?:experience|exp\.?)[:\s-]*(\d{1,2})\+?/gi,
    /(?:experience|exp\.?)[:\s-]*(\d{1,2})\+\s*(?:years?|yrs?)/gi,
    /(?:over|more than)\s+(\d{1,2})\+\s*(?:years?|yrs?)(?:\s+of)?\s*(?:experience|exp\.?)?/gi,
    /(\d{1,2})\+\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional|industry|it|software)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const years = Number.parseInt(match[1] ?? "", 10);
      if (years >= 1 && years <= 45) {
        const plus = match[0].includes("+") || years >= 10;
        if (!best || years > best.years) best = { years, plus };
      }
    }
  }

  return best;
}

function extractEmploymentRanges(text: string) {
  const ranges: Array<{ start: MonthPoint; end: MonthPoint; raw: string }> = [];
  const rangePattern =
    /(\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*)?(\d{4}|\d{2})\s*(?:[-–—]|to)\s*(present|current|now|(?:\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s*)?(?:\d{4}|\d{2}))/gi;

  for (const match of text.matchAll(rangePattern)) {
    const startToken = `${match[1] ?? ""}${match[2]}`.trim();
    const endToken = match[3].trim();
    const start = parseDateToken(startToken);
    const end = parseDateToken(endToken);
    if (!start || !end) continue;
    if (monthIndex(end) < monthIndex(start)) continue;
    ranges.push({ start, end, raw: match[0].trim() });
  }

  return ranges;
}

function extractEmploymentEntries(text: string, ranges: ReturnType<typeof extractEmploymentRanges>) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const entries: string[] = [];

  for (const line of lines) {
    if (!/\d{4}/.test(line)) continue;
    if (!/(present|current|\d{4})/i.test(line)) continue;
    if (line.length < 8 || line.length > 180) continue;
    if (/^(phone|email|address|linkedin|github|http)/i.test(line)) continue;
    entries.push(line);
  }

  if (entries.length >= 2) return entries.slice(0, 8);

  return ranges.slice(0, 8).map((range) => range.raw);
}

export function analyzeResumeExperience(resumeText: string): CareerSummary {
  const trimmed = resumeText.trim();
  if (!trimmed) {
    return {
      explicitTotalYears: null,
      explicitPlus: false,
      computedTotalYears: null,
      employmentEntries: [],
      yearsLabel: null,
      shouldMentionYears: false,
    };
  }

  const explicit = extractExplicitTotalYears(trimmed);
  const ranges = extractEmploymentRanges(trimmed);
  const merged = mergeRanges(ranges);

  let computedTotalYears: number | null = null;
  let computedPlus = false;

  if (merged.length >= 1) {
    const totalMonths = merged.reduce(
      (sum, range) => sum + (monthIndex(range.end) - monthIndex(range.start) + 1),
      0,
    );
    const computed = monthsToYearsLabel(totalMonths);
    computedTotalYears = computed.years;
    computedPlus = computed.plus;
  }

  const employmentEntries = extractEmploymentEntries(trimmed, ranges);

  let yearsLabel: string | null = null;
  let shouldMentionYears = false;

  if (explicit) {
    yearsLabel = `${explicit.years}${explicit.plus ? "+" : ""} years`;
    shouldMentionYears = true;
  } else if (merged.length >= 2 && computedTotalYears) {
    yearsLabel = `${computedTotalYears}${computedPlus ? "+" : ""} years`;
    shouldMentionYears = true;
  } else if (merged.length === 1 && computedTotalYears && computedTotalYears >= 3) {
    yearsLabel = `${computedTotalYears}${computedPlus ? "+" : ""} years`;
    shouldMentionYears = true;
  }

  return {
    explicitTotalYears: explicit?.years ?? null,
    explicitPlus: explicit?.plus ?? false,
    computedTotalYears,
    employmentEntries,
    yearsLabel,
    shouldMentionYears,
  };
}

export function buildCareerAnchorLines(summary: CareerSummary): string[] {
  const lines: string[] = [
    "RESUME GROUND TRUTH — every personal fact in your answer MUST match the resume below:",
  ];

  if (summary.shouldMentionYears && summary.yearsLabel) {
    lines.push(
      `- Total professional experience: ${summary.yearsLabel} (across ALL companies/roles in the resume — never understate or substitute a smaller number like 5 years)`,
    );
  } else {
    lines.push(
      "- Do NOT state a total years-of-experience number — the resume lists multiple roles without a clear single total. Instead describe career progression across the real companies and roles below.",
    );
  }

  if (summary.employmentEntries.length) {
    lines.push("- Work history from resume (mention these companies/roles, not one generic employer):");
    for (const entry of summary.employmentEntries) {
      lines.push(`  • ${entry}`);
    }
  }

  lines.push(
    "- NEVER invent employers, degrees, or tenure. NEVER collapse multiple jobs into one vague 'tech company'.",
  );
  lines.push("- Use exact company names, titles, and technologies from the resume only.");

  return lines;
}
