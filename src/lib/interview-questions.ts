import { prisma } from "@/lib/prisma";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Upsert one DB row per calendar day — `question` is the full local JSON file string. */
export async function upsertInterviewDayFiles(
  userId: string,
  days: Array<{ date: string; question: string }>,
) {
  const saved: string[] = [];

  for (const item of days) {
    const date = item.date.trim();
    const question = item.question.trim();
    if (!DATE_RE.test(date) || !question) continue;

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
