import { z } from "zod";
import { MODE_IDS } from "@/lib/constants";

/** Soft budget for compact Interactive taskContext (not a full TaskSession dump). */
export const ANALYZE_TASK_CONTEXT_MAX_CHARS = 8000;

/**
 * Analyze / solve request body.
 * questionText + imageBase64 + taskContext may be sent together (Interactive / Hands-on).
 * Existing voice / text / screenshot-only clients remain valid — all new fields optional.
 */
export const analyzeStreamRequestSchema = z
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
    documentContext: z.string().max(20000).optional(),
    documentName: z.string().max(200).optional(),
    /**
     * Capture channel label. Unchanged enum for backward compatibility.
     * Interactive capability is `interactiveHandsOn`, not a new InterviewModeId.
     */
    source: z.enum(["voice", "screenshot", "text"]).optional(),
    /**
     * Compact AI-facing Interactive / Hands-on context (string).
     * Optional — normal solves omit this.
     */
    taskContext: z.string().max(ANALYZE_TASK_CONTEXT_MAX_CHARS).optional(),
    /**
     * Session capability flag (not a domain / InterviewModeId).
     * Optional — existing clients omit this.
     */
    interactiveHandsOn: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.questionText?.trim() || data.imageBase64), {
    message: "Send mode plus questionText or imageBase64",
  });

export type AnalyzeStreamRequest = z.infer<typeof analyzeStreamRequestSchema>;
