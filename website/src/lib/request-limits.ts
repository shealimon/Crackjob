/** ~4 MiB JPEG as base64 — above desktop prepped captures, below abuse payloads. */
export const MAX_IMAGE_BASE64_CHARS = 6_000_000;

/** Whisper / WAV uploads — generous for long voice chunks. */
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

/** Resume upload — matches Supabase bucket fileSizeLimit (8 MiB) with headroom. */
export const MAX_RESUME_BYTES = 8 * 1024 * 1024;

export function estimateBase64DecodedBytes(base64: string): number {
  const stripped = base64.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  const padding = stripped.endsWith("==") ? 2 : stripped.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((stripped.length * 3) / 4) - padding);
}
