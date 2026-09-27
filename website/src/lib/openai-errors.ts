import OpenAI from "openai";

export function mapOpenAiError(error: unknown, fallback: string) {
  if (error instanceof OpenAI.APIError) {
    return {
      message: error.message || fallback,
      status: error.status ?? 500,
    };
  }

  return {
    message: error instanceof Error ? error.message : fallback,
    status: 500,
  };
}
