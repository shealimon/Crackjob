import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import WordExtractor from "word-extractor";

export const RESUME_TEXT_MAX = 8000;
export const RESUME_FILE_MAX_BYTES = 8 * 1024 * 1024;

const SUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".markdown",
  ".rtf",
]);

export function resumeExtension(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

export function isSupportedResumeFilename(filename: string) {
  return SUPPORTED_EXTENSIONS.has(resumeExtension(filename));
}

export function normalizeResumeText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, RESUME_TEXT_MAX);
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function parseWord(buffer: Buffer, ext: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const tmpPath = path.join(tmpDir, `crack-resume-${Date.now()}${ext}`);
  await fs.writeFile(tmpPath, buffer);
  try {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(tmpPath);
    return doc.getBody();
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}

function parsePlainText(buffer: Buffer): string {
  return buffer.toString("utf8");
}

function parseRtf(buffer: Buffer): string {
  const raw = buffer.toString("utf8");
  return raw
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\{\\[^}]+\}/g, " ")
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\[a-z]+\d* ?/gi, " ")
    .replace(/[{}]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export async function parseResumeFile(
  buffer: Buffer,
  filename: string,
): Promise<{ text: string; truncated: boolean }> {
  if (buffer.length > RESUME_FILE_MAX_BYTES) {
    throw new Error("Resume file is too large (max 8 MB).");
  }

  const ext = resumeExtension(filename);
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      "Unsupported file type. Upload PDF, DOC, DOCX, TXT, MD, or RTF — or paste your resume.",
    );
  }

  let raw = "";
  switch (ext) {
    case ".pdf":
      raw = await parsePdf(buffer);
      break;
    case ".doc":
    case ".docx":
      raw = await parseWord(buffer, ext);
      break;
    case ".rtf":
      raw = parseRtf(buffer);
      break;
    default:
      raw = parsePlainText(buffer);
      break;
  }

  const normalized = normalizeResumeText(raw);
  if (!normalized) {
    throw new Error(
      "Could not extract text from this file. Try a different format or paste your resume.",
    );
  }

  const truncated = raw.trim().length > RESUME_TEXT_MAX;
  return { text: normalized, truncated };
}
