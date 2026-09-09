import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { json, optionsCors } from "@/lib/http";
import {
  listInterviewQuestions,
  upsertInterviewDayFiles,
} from "@/lib/interview-questions";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const batchSchema = z.object({
  days: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        /// Full local day JSON file as a string
        question: z.string().min(2).max(5_000_000),
      }),
    )
    .min(1)
    .max(60),
});

export function OPTIONS() {
  return optionsCors();
}

/** List synced day JSON rows for this user. */
export async function GET(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") || undefined,
    cursor: url.searchParams.get("cursor") || undefined,
  });

  if (!parsed.success) {
    return json({ error: "Invalid query" }, { status: 400 });
  }

  const questions = await listInterviewQuestions(authed.userId, parsed.data);
  return json({ questions });
}

/** Upsert one row per day — body.days[].question is the full local JSON file string. */
export async function POST(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const body = batchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return json({ error: "Send days[{ date, question }] to sync" }, { status: 400 });
  }

  const savedDates = await upsertInterviewDayFiles(authed.userId, body.data.days);
  return json({
    ok: true,
    saved: savedDates.length,
    dates: savedDates,
  });
}
