import { prisma } from "@/lib/prisma";

/** Record a completed AI solve for daily charts (no balance wallet). */
export async function recordAiUsage(options: {
  userId: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  creditsUsed?: number;
  accessLevel?: "full" | "explore";
  error?: string;
  id?: string;
}) {
  return prisma.aiUsage.create({
    data: {
      ...(options.id ? { id: options.id } : {}),
      userId: options.userId,
      model: options.model,
      inputTokens: options.inputTokens ?? 0,
      outputTokens: options.outputTokens ?? 0,
      creditsUsed: options.creditsUsed ?? 0,
      accessLevel: options.accessLevel ?? "full",
      error: options.error,
    },
  });
}

export type DailyUsagePoint = {
  date: string;
  creditsUsed: number;
  solves: number;
  exploreSolves: number;
  fullSolves: number;
};

/** Calendar YYYY-MM-DD in IST — product is India-first; UTC bucketing shifts late-night solves. */
function istDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function istTodayKey(): string {
  return istDateKey(new Date());
}

function addIstDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + delta, 6, 30, 0));
  return istDateKey(utc);
}

export async function dailyUsageByDay(
  userId: string,
  days = 14,
): Promise<DailyUsagePoint[]> {
  const endKey = istTodayKey();
  const startKey = addIstDays(endKey, -(days - 1));
  const since = new Date(`${startKey}T00:00:00+05:30`);

  const rows = await prisma.aiUsage.findMany({
    where: { userId, error: null, createdAt: { gte: since } },
    select: { creditsUsed: true, createdAt: true, accessLevel: true },
    orderBy: { createdAt: "asc" },
  });

  const map = new Map<
    string,
    { creditsUsed: number; solves: number; exploreSolves: number; fullSolves: number }
  >();
  for (let i = 0; i < days; i += 1) {
    map.set(addIstDays(startKey, i), {
      creditsUsed: 0,
      solves: 0,
      exploreSolves: 0,
      fullSolves: 0,
    });
  }
  for (const row of rows) {
    const key = istDateKey(row.createdAt);
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.creditsUsed += row.creditsUsed;
    bucket.solves += 1;
    if (row.accessLevel === "explore") bucket.exploreSolves += 1;
    else bucket.fullSolves += 1;
  }

  return [...map.entries()].map(([date, value]) => ({ date, ...value }));
}

export type AiUsageEvent = {
  id: string;
  createdAt: string;
  accessLevel: "full" | "explore";
  creditsUsed: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
};

/** Recent solve rows for the Usage event table. */
export async function listRecentAiUsage(
  userId: string,
  take = 500,
): Promise<AiUsageEvent[]> {
  const rows = await prisma.aiUsage.findMany({
    where: { userId, error: null },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      createdAt: true,
      accessLevel: true,
      creditsUsed: true,
      inputTokens: true,
      outputTokens: true,
      model: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    accessLevel: row.accessLevel === "explore" ? "explore" : "full",
    creditsUsed: row.creditsUsed,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    model: row.model,
  }));
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
