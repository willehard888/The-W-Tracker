// Supabase Storage image-transform helper.
//
// Rewrites a public object URL to Supabase's on-the-fly render endpoint with
// width/quality params, so we never download a multi-MB original to display a
// 32px avatar or a thumbnail. The browser's `Accept: image/webp` header makes
// Supabase return WebP automatically — a feed thumbnail drops ~2.1MB → ~70KB,
// an avatar → ~20KB. Transforms are enabled on this project (Pro plan).
//
// SAFE: only touches Supabase `/storage/v1/object/public/` URLs. Data URIs,
// external avatars (OAuth), already-rendered URLs and empty values pass
// through untouched, so a transform can never break a non-Supabase image.

const OBJECT_SEG = "/storage/v1/object/public/";
const RENDER_SEG = "/storage/v1/render/image/public/";

interface ImgOpts {
  /** CSS pixel width of the rendered element (retina is applied automatically). */
  width: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

// Cap device-pixel-ratio at 2: 2× is already crisp for photos on phones and
// roughly halves the bytes vs 3× — a deliberate sharpness/size trade-off.
const dpr = (): number =>
  typeof window !== "undefined" ? Math.min(Math.round(window.devicePixelRatio || 1), 2) : 2;

export function transformImage(url: string | null | undefined, opts: ImgOpts): string {
  if (!url || typeof url !== "string") return "";
  if (!url.includes(OBJECT_SEG)) return url; // not a transformable Supabase object
  if (url.includes("?")) return url;          // already has params — don't double up

  const scale = dpr();
  const params = new URLSearchParams();
  params.set("width", String(Math.round(opts.width * scale)));
  if (opts.height) params.set("height", String(Math.round(opts.height * scale)));
  params.set("quality", String(opts.quality ?? 70));
  params.set("resize", opts.resize ?? "cover");

  return url.replace(OBJECT_SEG, RENDER_SEG) + "?" + params.toString();
}

/** Square, retina-aware avatar URL sized to the rendered px. */
export function avatarUrl(url: string | null | undefined, px: number): string {
  return transformImage(url, { width: px, height: px, quality: 70, resize: "cover" });
}
