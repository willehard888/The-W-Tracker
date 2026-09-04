import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Signed-URL resolution for PRIVATE storage buckets (proof-photos,
 * feed-images). Once a bucket is public=false, the old object/public
 * endpoint 404s and <img src> can't send an Authorization header — the only
 * way to render is a short-lived signed URL.
 *
 * Accepts either a bare storage key ("uid/photo.jpg") or a full historical
 * URL (".../object/public/<bucket>/<key>" or a signed one) — DB columns
 * contain a mix while the backfill settles, and this keeps every caller
 * agnostic to which era the row came from.
 */

const TTL_SECONDS = 60 * 60; // 1h — refreshed by the query cache below

// url → { signed, expiresAt }; module-level so all hooks share one cache.
const cache = new Map<string, { signed: string; expiresAt: number }>();

/** Extract the storage key from a full URL, or return the input as a key. */
export const storageKey = (bucket: string, keyOrUrl: string): string => {
  const m = keyOrUrl.match(new RegExp(`/object/(?:public|sign|authenticated)/${bucket}/([^?]+)`));
  return m ? decodeURIComponent(m[1]) : keyOrUrl.replace(/^\/+/, "");
};

/** Resolve a signed URL (cached). Returns null when signing fails. */
export const getSignedUrl = async (bucket: string, keyOrUrl: string): Promise<string | null> => {
  if (!keyOrUrl) return null;
  const key = storageKey(bucket, keyOrUrl);
  const cacheKey = `${bucket}/${key}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.signed;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(key, TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  cache.set(cacheKey, { signed: data.signedUrl, expiresAt: Date.now() + TTL_SECONDS * 1000 });
  return data.signedUrl;
};

/**
 * Hook form — resolves once per (bucket, key) with a shared react-query
 * cache; re-signs automatically before the TTL runs out.
 */
// ── Media-URL resolution for mixed-bucket columns ────────────────────────
// feed_posts.image_url can point at feed-images OR proof-photos (check-in
// posts reuse the proof URL), and rows predate the private flip with full
// object/public URLs. The DB value stays as-is — a canonical pointer that
// encodes bucket+key — and rendering resolves it here.

const PRIVATE_BUCKETS = new Set(["proof-photos", "feed-images", "meal-photos"]);

export const parseStorageUrl = (url: string): { bucket: string; key: string } | null => {
  const m = url.match(/\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  return m ? { bucket: m[1], key: decodeURIComponent(m[2]) } : null;
};

/** True when the URL points at one of our private buckets (needs signing). */
export const isPrivateStorageUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const p = parseStorageUrl(url);
  return !!p && PRIVATE_BUCKETS.has(p.bucket);
};

/**
 * Resolve any stored media URL for rendering:
 * - private-bucket URLs → short-lived signed URL (optionally transformed —
 *   signing and resizing happen in one server round via createSignedUrl's
 *   transform option)
 * - public buckets (avatars) / external URLs → passed through untouched
 * Returns null while a needed signature is still resolving.
 */
/**
 * Imperative form of the media signing below — shared by the hook and the
 * app-shell prefetcher so warmed cache entries hit the exact same logic.
 */
export const signMediaUrl = async (
  parsed: { bucket: string; key: string },
  transform?: { width?: number; quality?: number },
): Promise<string | null> => {
  const { data: signed, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(
      parsed.key,
      TTL_SECONDS,
      transform?.width
        ? { transform: { width: Math.round(transform.width * 2), quality: transform.quality ?? 82, resize: "cover" as const } }
        : undefined,
    );
  if (error || !signed?.signedUrl) {
    // Transform can fail on odd formats — retry plain.
    const { data: plain } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.key, TTL_SECONDS);
    return plain?.signedUrl ?? null;
  }
  return signed.signedUrl;
};

/** Query key for a signed media URL — MUST stay in sync with useSignedMediaUrl. */
export const signedMediaKey = (url: string, transform?: { width?: number; quality?: number }) =>
  ["signed-media", url, transform?.width ?? 0, transform?.quality ?? 0] as const;

export const SIGNED_MEDIA_STALE_MS = (TTL_SECONDS - 300) * 1000;

export const useSignedMediaUrl = (
  url: string | null | undefined,
  transform?: { width?: number; quality?: number },
): string | null => {
  const parsed = url ? parseStorageUrl(url) : null;
  const needsSign = !!parsed && PRIVATE_BUCKETS.has(parsed.bucket);
  const { data } = useQuery({
    queryKey: signedMediaKey(url ?? "", transform),
    enabled: needsSign,
    staleTime: SIGNED_MEDIA_STALE_MS,
    gcTime: TTL_SECONDS * 1000,
    queryFn: () => signMediaUrl(parsed!, transform),
  });
  if (!url) return null;
  return needsSign ? (data ?? null) : url;
};
