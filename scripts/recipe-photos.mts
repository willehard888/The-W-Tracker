/**
 * Recipe photography — fetch and install.
 *
 * The original recipe images were AI-generated and read as such: unnaturally
 * uniform tomato halves, plastic-looking cheese, the hyper-detailed sheen that
 * makes a wellness app look synthetic. These are real photographs from
 * Unsplash, whose licence permits commercial use without attribution
 * (https://unsplash.com/license).
 *
 * Every photo below was viewed before being committed. That is not optional:
 * a text search for "loaded sweet potato" first returned a diner baked potato
 * under processed cheese, and "burger bowl" returned an Indonesian meatball
 * soup. Roughly a third of the first picks were wrong for their dish — plausible
 * from the alt text, obviously wrong on sight. If you swap an id here, look at
 * the result before committing it.
 *
 * Usage: npx vite-node scripts/recipe-photos.mts
 *   --check   list what would change, write nothing
 */
import { writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RECIPES } from "@/data/recipes";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/** recipe id → Unsplash photo id. One line per dish, so a swap is one edit. */
const PHOTOS: Record<string, string> = {
  "greek-chicken-bowl": "1787087090329-63d501db683c",
  "lemon-garlic-salmon-quinoa": "1539136788836-5699e78bfc75",
  "loaded-sweet-potato": "1585036746932-2680059332cc",
  "steak-taco-bowl": "1762631383846-6bead15b9796",
  "teriyaki-beef-stir-fry": "1757190991704-3e612bbe0911",
  "chicken-shawarma-plate": "1781334266250-a7e72fdf539f",
  "beef-bolognese": "1785396347369-b5e70e3f3af3",
  "banana-protein-pancakes": "1528207776546-365bb710ee93",
  "apple-pie-protein-bowl": "1603199477811-71c45c02f10d",
  "sweet-potato-black-bean-taco-bowl": "1705177114594-261331bcb0b6",
  "sirloin-steak-chimichurri": "1785695691259-3f09db710535",
  "halloumi-power-plate": "1723476647983-cc0e6311104a",
  "burger-bowl": "1785961259169-62fb51f5f6e6",
  "berry-cheesecake-bowl": "1610441009633-b6ca9c6d4be2",
  "grilled-chicken-caesar-salad": "1782839577893-da9383e55c96",
};

// Square everywhere: the list shows a small tile and the detail view shows the
// same photo as its hero, so one crop serves both. `thumb` stays smaller
// because it renders at ~64px and shipping a 1000px file for that is waste.
const SIZES = [
  { dir: "square", w: 1000 },
  { dir: "thumb", w: 560 },
] as const;

const url = (id: string, w: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&h=${w}&fit=crop&q=80&fm=jpg`;

const missing = RECIPES.filter((r) => !PHOTOS[r.id]).map((r) => r.id);
if (missing.length) {
  console.error(`No photo mapped for: ${missing.join(", ")}`);
  process.exit(1);
}
const orphans = Object.keys(PHOTOS).filter((id) => !RECIPES.some((r) => r.id === id));
if (orphans.length) console.warn(`Mapped but no such recipe: ${orphans.join(", ")}`);

if (CHECK) {
  console.log(`${RECIPES.length} recipes, all mapped. Sizes: ${SIZES.map((s) => s.dir).join(", ")}`);
  process.exit(0);
}

for (const { dir, w } of SIZES) {
  const out = resolve(ROOT, "src/assets/recipes", dir);
  mkdirSync(out, { recursive: true });
  for (const [id, photo] of Object.entries(PHOTOS)) {
    const res = await fetch(url(photo, w));
    if (!res.ok) throw new Error(`${dir}/${id}: HTTP ${res.status}`);
    writeFileSync(resolve(out, `${id}.jpg`), Buffer.from(await res.arrayBuffer()));
    console.log(`${dir}/${id}.jpg`);
  }
}

// The old `poster` set were cream-background recipe CARDS, not photographs —
// every quantity and step baked in as pixels, in a palette from a different
// product. The detail view now renders that content as text and uses the
// square photo as its hero, so the whole directory is dead weight.
const posters = resolve(ROOT, "src/assets/recipes/poster");
if (existsSync(posters)) {
  for (const f of readdirSync(posters)) unlinkSync(resolve(posters, f));
  console.log(`Removed ${posters}`);
}

console.log("Done.");
