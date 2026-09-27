import { prisma } from "@/lib/prisma";
import { cleanDayQuestionJson, cleanQuestionTexts } from "@/lib/question-clean";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type DayQuestions = {
  date: string;
  questions: string[];
};

/** Upsert one DB row per calendar day — `question` is the full local JSON file string. */
export async function upsertInterviewDayFiles(
  userId: string,
  days: Array<{ date: string; question: string }>,
) {
  const saved: string[] = [];

  for (const item of days) {
    const date = item.date.trim();
    const raw = item.question.trim();
    if (!DATE_RE.test(date) || !raw) continue;

    // Heuristic clean once on sync — no GPT, no extra round-trips.
    const question = cleanDayQuestionJson(raw);

    await prisma.interviewQuestion.upsert({
      where: {
        userId_date: { userId, date },
      },
      create: {
        userId,
        date,
        question,
      },
      update: {
        question,
      },
    });

    saved.push(date);
  }

  return saved;
}

/** Parse day JSON and return cleaned question texts (deduped, unclear audio dropped). */
export function parseDayQuestions(date: string, questionJson: string): DayQuestions {
  try {
    const parsed = JSON.parse(questionJson) as {
      date?: string;
      sessions?: Array<{
        entries?: Array<{ question?: string }>;
      }>;
    };
    const raw: string[] = [];
    for (const session of parsed.sessions ?? []) {
      for (const entry of session.entries ?? []) {
        const q = entry.question?.trim();
        if (q) raw.push(q);
      }
    }
    const questions = cleanQuestionTexts(raw);
    return {
      date: parsed.date && DATE_RE.test(parsed.date) ? parsed.date : date,
      questions,
    };
  } catch {
    return { date, questions: [] };
  }
}

export async function listInterviewQuestions(
  userId: string,
  options?: {
    limit?: number;
    cursor?: string;
  },
) {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);

  return prisma.interviewQuestion.findMany({
    where: {
      userId,
      ...(options?.cursor ? { date: { lt: options.cursor } } : {}),
    },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      date: true,
      question: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/** Paginated day rows for the website — recent dates first; questions text only. */
export async function listInterviewQuestionsPage(
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
  },
) {
  const pageSize = Math.min(Math.max(options?.pageSize ?? 10, 1), 50);
  const page = Math.max(options?.page ?? 1, 1);
  const skip = (page - 1) * pageSize;

  const [total, rows] = await Promise.all([
    prisma.interviewQuestion.count({ where: { userId } }),
    prisma.interviewQuestion.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
      select: {
        date: true,
        question: true,
      },
    }),
  ]);

  const days = rows
    .map((row) => parseDayQuestions(row.date, row.question))
    .filter((day) => day.questions.length > 0);

  return {
    days,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
