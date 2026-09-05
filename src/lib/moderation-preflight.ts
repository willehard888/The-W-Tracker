// Client-side moderation pre-flight: validate, generate thumbnail, hash.
// Reduces AI calls and bandwidth before hitting the edge function.

const MIN_BYTES = 10 * 1024; // 10 KB
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export interface PreflightResult {
  ok: boolean;
  reason?: string;
}

export function validateFile(file: File): PreflightResult {
  if (!file) return { ok: false, reason: "No file selected" };
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: "Only image files are supported" };
  }
  if (file.size < MIN_BYTES) {
    return { ok: false, reason: "Image too small — try a real photo" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "Image too large (max 10MB)" };
  }
  return { ok: true };
}

export interface ThumbnailResult {
  b64: string; // data URL: "data:image/jpeg;base64,..."
  hash: string; // SHA-256 hex of thumbnail bytes
  width: number;
  height: number;
}

export async function generateThumbnail(
  file: File,
  maxSize = 256,
): Promise<ThumbnailResult> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1);
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Thumbnail encode failed"))),
      "image/jpeg",
      0.85,
    );
  });

  const arrayBuffer = await blob.arrayBuffer();
  const hash = await sha256Hex(arrayBuffer);
  const b64 = await blobToDataUrl(blob);
  return { b64, hash, width: w, height: h };
}

export async function sha256Hex(data: ArrayBuffer | Blob): Promise<string> {
  const buf = data instanceof Blob ? await data.arrayBuffer() : data;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function getFriendlyMessage(
  categories: string[] = [],
  fallback?: string,
): string {
  const set = new Set(categories);
  if (set.has("nudity")) return "Modesty required — keep clothes on in proofs.";
  if (set.has("spam") || set.has("advertising"))
    return "No promotional content allowed.";
  if (set.has("fake_screenshot") || set.has("watermark"))
    return "Use original photos, not screenshots.";
  if (set.has("ai_generated"))
    return "Real proofs only — AI-generated content not accepted.";
  if (set.has("violence")) return "Violent content is not allowed.";
  if (set.has("hate")) return "Hateful content is not allowed.";
  if (set.has("drugs")) return "Drug or alcohol content is not allowed.";
  if (set.has("self_harm"))
    return "We can't accept this. If you're struggling, please reach out for help.";
  if (set.has("low_effort") || set.has("off_topic"))
    return "Try a clearer fitness or discipline-related photo.";
  if (fallback === "moderation_unavailable_retry")
    return "Moderation is temporarily unavailable. Please try again in a moment.";
  return "This proof couldn't be verified. Try again with clearer content.";
}
