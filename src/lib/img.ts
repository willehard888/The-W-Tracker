// Supabase Storage image-transform helper.
//
// Rewrites a public object URL to Supabase's on-the-fly render endpoint with
// width/quality params, so we never download a multi-MB original to display a
// 32px avatar or a thumbnail. Transforms are enabled on this project (the
// render endpoint resolves objects rather than returning "not enabled").
//
// SAFE: only touches Supabase `/storage/v1/object/public/` URLs. Data URIs,
// external avatars (OAuth), already-rendered URLs and empty values pass
// through untouched.

const OBJECT_SEG = "/storage/v1/object/public/";
const RENDER_SEG = "/storage/v1/render/image/public/";

interface ImgOpts {
  /** CSS pixel width of the rendered element (retina is applied automatically). */
  width: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

const dpr = (): number =>
  typeof window !== "undefined" ? Math.min(Math.round(window.devicePixelRatio || 1), 3) : 2;

export function transformImage(url: string | null | undefined, _opts: ImgOpts): string {
  // NOTE: Supabase image transforms (the render/image endpoint) are NOT enabled
  // on this project's plan — they return 403 "FeatureNotEnabled". The previous
  // implementation rewrote URLs to that endpoint, so every AppImage paid a
  // failed round-trip (403) before falling back to the full original. Until the
  // plan enables transforms, return the original URL directly so images load on
  // the first request. (Re-enable the rewrite below once transforms are on.)
  return url || "";
}

// Kept for when transforms get enabled (Pro plan + image transformation add-on):
//   const scale = dpr();
//   const params = new URLSearchParams({ width: String(Math.round(opts.width * scale)), ... });
//   return url.replace(OBJECT_SEG, RENDER_SEG) + "?" + params.toString();
void OBJECT_SEG; void RENDER_SEG; void dpr;

/** Square, retina-aware avatar URL sized to the rendered px. */
export function avatarUrl(url: string | null | undefined, px: number): string {
  return transformImage(url, { width: px, height: px, quality: 70, resize: "cover" });
}
