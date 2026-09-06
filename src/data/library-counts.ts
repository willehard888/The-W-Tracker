// Home (LibraryHub) shows the recipe count but must not import the catalog —
// importing src/data/recipes.ts for `.length` put every recipe in the entry
// chunk. The literal is pinned to RECIPES.length by
// src/data/__tests__/library-counts.test.ts, so it can't go stale silently.
export const RECIPE_COUNT = 15;
