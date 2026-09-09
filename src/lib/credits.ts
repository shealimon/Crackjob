import { prisma } from "@/lib/prisma";

/** Record token usage for daily charts (no balance wallet). */
export async function recordAiUsage(options: {
  userId: string;
  mode: string;
  status: "running" | "done" | "error";
  inputTokens?: number;
  outputTokens?: number;
  creditsUsed?: number;
  accessLevel?: "full" | "explore";
  error?: string;
  id?: string;
}) {
  if (options.id) {
    return prisma.aiUsage.update({
      where: { id: options.id },
      data: {
        status: options.status,
        inputTokens: options.inputTokens ?? 0,
        outputTokens: options.outputTokens ?? 0,
        creditsUsed: options.creditsUsed ?? 0,
        accessLevel: options.accessLevel ?? "full",
        error: options.error,
      },
    });
  }
  return prisma.aiUsage.create({
    data: {
      userId: options.userId,
      mode: options.mode,
      status: options.status,
      inputTokens: options.inputTokens ?? 0,
      outputTokens: options.outputTokens ?? 0,
      creditsUsed: options.creditsUsed ?? 0,
      accessLevel: options.accessLevel ?? "full",
      error: options.error,
    },
  });
}

export async function dailyUsageByDay(userId: string, days = 14) {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.aiUsage.findMany({
    where: { userId, status: "done", createdAt: { gte: since } },
    select: { creditsUsed: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const map = new Map<string, number>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + row.creditsUsed);
  }

  return [...map.entries()].map(([date, creditsUsed]) => ({ date, creditsUsed }));
}

/** @deprecated kept name for call sites that threw on low wallet credits */
export class InsufficientCreditsError extends Error {
  constructor(
    readonly balance: number,
    readonly required: number,
  ) {
    super(`Not enough credits. Have ${balance}, need ${required}.`);
    this.name = "InsufficientCreditsError";
  }
}
