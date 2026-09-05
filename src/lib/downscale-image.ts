// Downscale + re-encode an image File in the browser (via canvas) BEFORE upload,
// so we never store or serve multi-MB originals. Supabase image transforms are
// not enabled on this plan, so shrinking at upload time is the only lever for
// user-generated images (avatars, feed/tribe photos).
//
// FAIL-OPEN: returns the ORIGINAL file on any problem (not an image, HEIC the
// browser can't decode, canvas error, or a re-encode that wouldn't help). An
// optimization must never block or break an upload.

export interface DownscaleOpts {
  /** Max width/height in px (longest side). */
  maxDim?: number;
  /** JPEG quality, 0..1. */
  quality?: number;
  /** Skip work entirely if the file is already at/below this size (bytes). */
  skipUnder?: number;
}

export async function downscaleImage(file: File, opts: DownscaleOpts = {}): Promise<File> {
  const { maxDim = 1280, quality = 0.8, skipUnder = 200_000 } = opts;
  try {
    // HEIC/HEIF (the iPhone default) must be CONVERTED to JPEG — browsers/WebViews
    // won't render a .heic <img>, so an un-converted HEIC posts as a broken image.
    // iOS WKWebView CAN decode HEIC into a canvas, so the re-encode below works on
    // device; if a non-Apple browser can't decode it, we fail open (return original).
    const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
    if (!file.type.startsWith("image/") && !isHeic) return file;
    // HEIC always needs conversion regardless of size; other formats can skip if tiny.
    if (!isHeic && file.size <= skipUnder) return file;

    // Decode — prefer createImageBitmap, fall back to <img>.
    let width = 0;
    let height = 0;
    let source: CanvasImageSource | null = null;
    let bitmap: ImageBitmap | null = null;
    let objectUrl: string | null = null;

    // "from-image" bakes the EXIF orientation into the pixels — without it an
    // iPhone portrait shot lands sideways in the canvas (and in the scanner).
    // Older WebKit rejects the option; fall back to the plain call there.
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      bitmap = await createImageBitmap(file).catch(() => null);
    }
    if (bitmap) {
      width = bitmap.width;
      height = bitmap.height;
      source = bitmap;
    } else {
      objectUrl = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement | null>((resolve) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => resolve(null);
        i.src = objectUrl!;
      });
      if (img) {
        width = img.naturalWidth;
        height = img.naturalHeight;
        source = img;
      }
    }

    if (!source || !width || !height) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return file;
    }

    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap?.close?.();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return file;
    }
    ctx.drawImage(source, 0, 0, w, h);
    bitmap?.close?.();
    if (objectUrl) URL.revokeObjectURL(objectUrl);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    // For HEIC we MUST return the JPEG even if it's larger — the original can't be
    // displayed. For normal formats, keep the original if re-encoding didn't shrink.
    if (!isHeic && blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
