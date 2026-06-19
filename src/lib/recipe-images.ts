// Locally-bundled, pre-optimized recipe images.
//
// Supabase image transformations are NOT enabled on this project's plan
// (render/image returns "FeatureNotEnabled"), so the Storage originals were
// ~2 MB PNGs that loaded slowly and forced a wasted 403 round-trip. These
// JPEGs are pre-resized (thumb ≤560px, poster ≤1000px) — ~30× smaller for the
// list thumbnails — and ship with the app, so they load instantly from the
// app's own CDN with no Supabase round-trip.
//
// Vite resolves each id → a hashed, cache-busted asset URL at build time.
// import.meta.glob patterns must be relative (aliases aren't supported here).

const thumbMods = import.meta.glob("../assets/recipes/thumb/*.jpg", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const posterMods = import.meta.glob("../assets/recipes/poster/*.jpg", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const byId = (mods: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(mods).map(([path, url]) => [
      path.split("/").pop()!.replace(/\.jpg$/, ""),
      url,
    ]),
  );

const THUMBS = byId(thumbMods);
const POSTERS = byId(posterMods);

/** Small list/home thumbnail (~50–70KB). Undefined if no image for this id. */
export const recipeThumb = (id: string): string | undefined => THUMBS[id];

/** Larger poster for the detail / zoom view (~200KB). */
export const recipePoster = (id: string): string | undefined => POSTERS[id];
