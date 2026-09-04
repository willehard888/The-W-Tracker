// Locally-bundled, pre-optimized recipe images.
//
// (Historical note: transforms were once unavailable here; they ARE enabled
// now — see src/lib/img.ts — but bundling stays the better call for these.)
// The Storage originals were ~2 MB PNGs that loaded slowly and forced a wasted
// 403 round-trip. These are pre-resized WebP (square 1000px, thumb 560px) and
// ship with the app, so they load instantly from the app's own CDN with no
// Supabase round-trip.
//
// Vite resolves each id → a hashed, cache-busted asset URL at build time.
// import.meta.glob patterns must be relative (aliases aren't supported here).

const thumbMods = import.meta.glob("../assets/recipes/thumb/*.webp", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

// Square food photographs — list tiles AND the detail hero. There used to be a
// third `poster` set: cream-background recipe CARDS carrying every quantity and
// step as pixels, which is why the detail view needed a pinch-to-zoom. That
// content is real text on the screen now, so only the photograph is bundled.
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
const SQUARES = byId(squareMods);

/** Small list/home thumbnail (560px). Undefined if no image for this id. */
export const recipeThumb = (id: string): string | undefined => THUMBS[id];

/** Full-size square photograph — list tiles and the detail hero (1000px). */
export const recipeSquare = (id: string): string | undefined => SQUARES[id];
