import sharp from "sharp";

const envWidth = Number(process.env.OPENAI_IMAGE_MAX_WIDTH ?? "1280");
const MAX_WIDTH = Number.isFinite(envWidth) && envWidth >= 768 ? Math.floor(envWidth) : 1280;
const envQuality = Number(process.env.OPENAI_IMAGE_QUALITY ?? "78");
const JPEG_QUALITY = Number.isFinite(envQuality) && envQuality >= 65 ? Math.floor(envQuality) : 78;
/** Desktop already ships ≤640 JPEG — skip sharp when payload looks prepped. */
const SKIP_REPROCESS_MAX_BYTES = 350_000;

function stripDataUrl(input: string) {
  const match = input.match(/^data:[^;]+;base64,(.+)$/);
  return match ? match[1] : input;
}

function isJpegMagic(buf: Buffer) {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

/** Resize + recompress for vision — keep text readable. Skip if desktop already prepped. */
export async function prepareVisionImage(imageBase64: string, mimeType?: string) {
  const stripped = stripDataUrl(imageBase64);
  const raw = Buffer.from(stripped, "base64");
  const looksJpeg =
    mimeType?.toLowerCase().includes("jpeg") ||
    mimeType?.toLowerCase().includes("jpg") ||
    isJpegMagic(raw);

  // Desktop capture already resizes to ≤768 JPEG — skip sharp + avoid re-encoding base64.
  if (looksJpeg && raw.length <= SKIP_REPROCESS_MAX_BYTES) {
    return {
      dataUrl: `data:image/jpeg;base64,${stripped}`,
      mimeType: "image/jpeg",
      bytes: raw.length,
      reprocessed: false,
    };
  }

  const resized = await sharp(raw, { failOn: "none" })
    .resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
      kernel: "lanczos3",
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return {
    dataUrl: `data:image/jpeg;base64,${resized.toString("base64")}`,
    mimeType: "image/jpeg",
    bytes: resized.length,
    reprocessed: true,
  };
}
