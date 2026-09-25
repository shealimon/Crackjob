import { assertCanSolve, getAccessSnapshot, invalidateAccessCache } from "@/lib/access";
import { analyzeStreamRequestSchema } from "@/lib/analyze-contract";
import { isAuthSkipped, requireUser } from "@/lib/api-auth";
import { applyFreeAnswerGate, type FreeAnswerTier } from "@/lib/explore-answer";
import { streamSolve, tokensToCredits, type StreamSolveEvent } from "@/lib/ai";
import { recordAiUsage } from "@/lib/credits";
import { json, ndjsonStream, optionsCors } from "@/lib/http";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { resolveLiveInterviewExperience } from "@/lib/live-experience";
import { resolveExtraContext } from "@/lib/resume-context";

const schema = analyzeStreamRequestSchema;

export function OPTIONS() {
  return optionsCors();
}

export async function POST(request: Request) {
  const authed = await requireUser(request);
  if ("error" in authed) {
    return json({ error: authed.error }, { status: authed.status });
  }

  const limited = checkRateLimit(`ai:analyze:${authed.userId}`, {
    limit: 90,
    windowMs: 60 * 1000,
  });
  if (!limited.ok) {
    return rateLimitResponse(limited.retryAfterSec);
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

  const isScreenshotOnly =
    Boolean(body.data.imageBase64) && !body.data.questionText?.trim();
  const isChatPaste = body.data.source === "text";
  // Chat/paste: never attach resume. Voice/audio: keep resume merge (HR / projects).
  // Screenshot: skip.
  const extraContext =
    isScreenshotOnly || isChatPaste
      ? undefined
      : await resolveExtraContext(authed.userId, body.data.extraContext);

  const liveExperience = await resolveLiveInterviewExperience(authed.userId);

  const solveOptions = {
    mode: body.data.mode,
    imageBase64: body.data.imageBase64,
    mimeType: body.data.mimeType,
    questionText: body.data.questionText,
    extraContext,
    conversationContext: body.data.conversationContext,
    // Forward when present so fused Interactive requests can include a doc + screen.
    // Existing voice/screenshot callers omit these fields.
    documentContext: body.data.documentContext,
    documentName: body.data.documentName,
    companyPack: body.data.companyPack,
    outputLanguage: body.data.outputLanguage,
    codeLanguage: body.data.codeLanguage,
    source: body.data.source,
    taskContext: body.data.taskContext,
    interactiveHandsOn: body.data.interactiveHandsOn,
    liveExperience,
  };

  const fullAccess = isAuthSkipped() || access.fullAccess;
  const answerTier: FreeAnswerTier = fullAccess ? "full" : (access.answerTier ?? "full");

  return ndjsonStream(async (send) => {
    const jobId = crypto.randomUUID();
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

        await handleSolveDone(event, {
          send,
          jobId,
          userId: authed.userId,
          mode: body.data.mode,
          fullAccess,
          answerTier,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analyze failed";
      send({
        type: "error",
        error: message,
        jobId,
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
    model: event.model,
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
    model: event.model,
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
