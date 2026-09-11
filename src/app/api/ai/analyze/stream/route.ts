import { z } from "zod";
import { assertCanSolve, getAccessSnapshot, invalidateAccessCache } from "@/lib/access";
import { isAuthSkipped, requireUser } from "@/lib/api-auth";
import { applyFreeAnswerGate, type FreeAnswerTier } from "@/lib/explore-answer";
import { streamSolve, tokensToCredits, type StreamSolveEvent } from "@/lib/ai";
import { MODE_IDS } from "@/lib/constants";
import { recordAiUsage } from "@/lib/credits";
import { json, ndjsonStream, optionsCors } from "@/lib/http";

const schema = z
  .object({
    mode: z.enum(MODE_IDS),
    questionText: z.string().max(8000).optional(),
    imageBase64: z.string().min(20).optional(),
    mimeType: z.string().max(40).optional(),
    companyPack: z.string().max(80).optional(),
    outputLanguage: z.string().max(40).optional(),
    codeLanguage: z.string().max(40).optional(),
    extraContext: z.string().max(8000).optional(),
    conversationContext: z.string().max(12000).optional(),
  })
  .refine((data) => Boolean(data.questionText?.trim() || data.imageBase64), {
    message: "Send mode plus questionText or imageBase64",
  });

export function OPTIONS() {
  return optionsCors();
}

export async function POST(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return json(
      { error: "Send mode plus a screenshot or pasted question" },
      { status: 400 },
    );
  }

  let access;
  if (!isAuthSkipped()) {
    try {
      access = await assertCanSolve(authed.userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upgrade required";
      // One snapshot for the 402 payload — avoid a second pre-stream DB round-trip on success.
      const snap = await getAccessSnapshot(authed.userId).catch(() => null);
      return json(
        {
          error: message,
          creditBalance: snap?.exploreRemaining ?? 0,
          creditsLow: true,
          exploreLimit: true,
          upgradeRequired: true,
        },
        { status: 402 },
      );
    }
  } else {
    access = await getAccessSnapshot(authed.userId);
  }

  const solveOptions = {
    mode: body.data.mode,
    imageBase64: body.data.imageBase64,
    mimeType: body.data.mimeType,
    questionText: body.data.questionText,
    extraContext: body.data.extraContext,
    conversationContext: body.data.conversationContext,
    companyPack: body.data.companyPack,
    outputLanguage: body.data.outputLanguage,
    codeLanguage: body.data.codeLanguage,
  };

  const fullAccess = isAuthSkipped() || access.fullAccess;
  const answerTier: FreeAnswerTier = fullAccess ? "full" : (access.answerTier ?? "full");

  return ndjsonStream(async (send) => {
    // Create usage row in parallel with the model call — never block first tokens on DB.
    const jobPromise = recordAiUsage({
      userId: authed.userId,
      mode: body.data.mode,
      status: "running",
      accessLevel: fullAccess ? "full" : "explore",
    });
    send({ type: "start", mode: body.data.mode });

    try {
      for await (const event of streamSolve(solveOptions)) {
        if (event.type === "delta") {
          const gated = applyFreeAnswerGate(event.result, answerTier, false);
          send({
            type: "delta",
            result: gated.result,
            partialAnswer: gated.partialAnswer,
            upgradePrompt: gated.upgradePrompt,
          });
          continue;
        }

        const job = await jobPromise;
        await handleSolveDone(event, {
          send,
          jobId: job.id,
          userId: authed.userId,
          mode: body.data.mode,
          fullAccess,
          answerTier,
        });
      }
    } catch (error) {
      const job = await jobPromise.catch(() => null);
      const message = error instanceof Error ? error.message : "Analyze failed";
      if (job) {
        void recordAiUsage({
          id: job.id,
          userId: authed.userId,
          mode: body.data.mode,
          status: "error",
          error: message,
          accessLevel: fullAccess ? "full" : "explore",
        }).catch(() => undefined);
      }
      send({
        type: "error",
        error: message,
        jobId: job?.id,
        status: 500,
      });
    }
  });
}

async function handleSolveDone(
  event: Extract<StreamSolveEvent, { type: "done" }>,
  ctx: {
    send: (payload: Record<string, unknown>) => void;
    jobId: string;
    userId: string;
    mode: string;
    fullAccess: boolean;
    answerTier: FreeAnswerTier;
  },
) {
  const creditsUsed = tokensToCredits(event.inputTokens, event.outputTokens);
  const gated = applyFreeAnswerGate(event.result, ctx.answerTier, true);

  await recordAiUsage({
    id: ctx.jobId,
    userId: ctx.userId,
    mode: ctx.mode,
    status: "done",
    inputTokens: event.inputTokens,
    outputTokens: event.outputTokens,
    creditsUsed,
    accessLevel: ctx.fullAccess ? "full" : "explore",
  });

  invalidateAccessCache(ctx.userId);
  const access = await getAccessSnapshot(ctx.userId);
  ctx.send({
    type: "done",
    jobId: ctx.jobId,
    mode: ctx.mode,
    demo: event.demo,
    creditsUsed,
    creditBalance: access.fullAccess ? 999_999 : (access.exploreRemaining ?? 0),
    creditsLow:
      !access.fullAccess &&
      (access.answerTier === "partial" ||
        access.answerTier === "blocked" ||
        (access.exploreRemaining ?? 0) <= 1),
    fullAccess: access.fullAccess,
    plan: access.plan,
    planStatus: access.status,
    endsAt: access.endsAt?.toISOString() ?? null,
    exploreRemaining: access.exploreRemaining,
    solvesToday: access.solvesToday,
    answerTier: access.answerTier,
    partialAnswer: gated.partialAnswer,
    upgradePrompt: gated.upgradePrompt,
    upgradeRequired: gated.partialAnswer,
    usage: {
      inputTokens: event.inputTokens,
      outputTokens: event.outputTokens,
    },
    result: gated.result,
  });
}
