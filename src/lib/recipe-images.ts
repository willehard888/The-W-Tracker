// Locally-bundled, pre-optimized recipe images.
//
// (Historical note: transforms were once unavailable here; they ARE enabled
// now — see src/lib/img.ts — but bundling stays the better call for these.)
// The Storage originals were
// ~2 MB PNGs that loaded slowly and forced a wasted 403 round-trip. These
// JPEGs are pre-resized (thumb ≤560px, poster ≤1000px) — ~30× smaller for the
// list thumbnails — and ship with the app, so they load instantly from the
// app's own CDN with no Supabase round-trip.
//
// Vite resolves each id → a hashed, cache-busted asset URL at build time.
// import.meta.glob patterns must be relative (aliases aren't supported here).

const thumbMods = import.meta.glob("../assets/recipes/thumb/*.webp", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const posterMods = import.meta.glob("../assets/recipes/poster/*.webp", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

// Square food-only crops (the appetizing dish, cut from the branded card's
// photo region) — used by the recipe LIST thumbnails so the tiny box shows
// centered food instead of an awkward slice of the full 2:3 card.
const squareMods = import.meta.glob("../assets/recipes/square/*.webp", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const byId = (mods: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(mods).map(([path, url]) => [
      path.split("/").pop()!.replace(/\.webp$/, ""),
      url,
    ]),
  );

const THUMBS = byId(thumbMods);
const POSTERS = byId(posterMods);
const SQUARES = byId(squareMods);

/** Small list/home thumbnail (~50–70KB). Undefined if no image for this id. */
export const recipeThumb = (id: string): string | undefined => THUMBS[id];

/** Larger poster for the detail / zoom view (~200KB). */
export const recipePoster = (id: string): string | undefined => POSTERS[id];

/** Square food-only crop for list thumbnails (480×480, retina-crisp). */
export const recipeSquare = (id: string): string | undefined => SQUARES[id];
