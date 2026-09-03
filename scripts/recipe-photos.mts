/**
 * Recipe photography — provenance and re-export.
 *
 * The images in src/assets/recipes are generated food photographs, made in
 * Canva from a prompt written against each recipe's own ingredient list. Two
 * earlier attempts are worth recording so nobody repeats them:
 *
 *  1. The original set was AI-generated and looked it — unnaturally uniform
 *     tomato halves, plastic cheese, the hyper-detailed sheen that makes a
 *     wellness app read as synthetic.
 *  2. Real stock photography (Unsplash/Pexels) fixed the realism but not the
 *     match: a text search for "loaded sweet potato" returns a diner baked
 *     potato under processed cheese, and "burger bowl" returns an Indonesian
 *     meatball soup. Roughly a third of the picks were plausible from the alt
 *     text and obviously wrong on sight — a stock photo is always somebody
 *     else's dish.
 *
 * Generating against the ingredient list solves the match, at the cost of the
 * images being generated rather than photographed. That trade was made
 * deliberately by the founder after seeing both side by side.
 *
 * HOW THESE WERE MADE (repeat this if a dish changes):
 *  - Canva `generate-design`, design_type `phone_wallpaper` — a type with no
 *    headline template, so the output is a bare image. Every other type
 *    returns a marketing poster with invented copy baked in.
 *  - One constant STYLE block (below) plus that recipe's real ingredients.
 *  - Export as jpg → 1080×1920 → centre-crop to 1000×1000, biased ABOVE centre
 *    (×0.62) because the bowl sits high in a 9:16 frame.
 *  - LOOK AT THE RESULT before committing it. Every one of these 15 was.
 *
 * STYLE BLOCK used for all 15, verbatim:
 *   "A single photorealistic overhead food photograph. NO text, NO titles, NO
 *   logos, NO graphics, NO borders, NO watermark — the entire frame is one
 *   photograph of food. […THE DISH: this recipe's ingredients…] STYLING: shot
 *   from directly above on a dark charcoal stone surface. Moody
 *   restaurant-cookbook lighting — one soft window light from the left, deep
 *   shadows to the right, warm highlights. Shallow depth of field. Muted dark
 *   palette, no bright white background, no coloured props, no cutlery, no
 *   drinks, no hands, no napkins. It must read as an actual photograph taken
 *   with a camera: real food texture, real irregular edges, real reflections.
 *   No illustration, no 3D render, no plastic sheen, no oversaturated colour."
 *
 * The Canva designs live in the founder's account and can be re-exported at
 * any time from the ids below — the generation does not have to be repeated.
 *
 * Usage: npx vite-node scripts/recipe-photos.mts -- --check
 */
import { readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { RECIPES } from "@/data/recipes";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** recipe id → Canva design id. Re-export from canva.com/design/<id>. */
export const CANVA_DESIGNS: Record<string, string> = {
  "greek-chicken-bowl": "DAHUI6xZFCA",
  "beef-bolognese": "DAHUJkw7i5o",
  "lemon-garlic-salmon-quinoa": "DAHUJn0MFVo",
  "loaded-sweet-potato": "DAHUJnozCy4",
  "steak-taco-bowl": "DAHUKCZ8NNk",
  "teriyaki-beef-stir-fry": "DAHUKGlFfq0",
  "chicken-shawarma-plate": "DAHUKFzLlb0",
  "banana-protein-pancakes": "DAHUKHS5AFI",
  "apple-pie-protein-bowl": "DAHUKPi8VkQ",
  "sweet-potato-black-bean-taco-bowl": "DAHUKNXIEpA",
  "sirloin-steak-chimichurri": "DAHUKIkri2o",
  "halloumi-power-plate": "DAHUKAPbHuQ",
  "burger-bowl": "DAHUKGT3rXo",
  "berry-cheesecake-bowl": "DAHUKMAuWUw",
  "grilled-chicken-caesar-salad": "DAHUKNrugts",
};

/** square = list tile + detail hero (1000px); thumb = small tile (560px). */
const SIZES = ["square", "thumb"] as const;

const problems: string[] = [];

for (const r of RECIPES) {
  if (!CANVA_DESIGNS[r.id]) problems.push(`${r.id}: no Canva design recorded`);
  for (const dir of SIZES) {
    if (!existsSync(resolve(ROOT, "src/assets/recipes", dir, `${r.id}.jpg`))) {
      problems.push(`${r.id}: missing ${dir}/${r.id}.jpg`);
    }
  }
}

for (const id of Object.keys(CANVA_DESIGNS)) {
  if (!RECIPES.some((r) => r.id === id)) problems.push(`${id}: design recorded but no such recipe`);
}

for (const dir of SIZES) {
  const files = readdirSync(resolve(ROOT, "src/assets/recipes", dir));
  for (const f of files) {
    const id = f.replace(/\.jpg$/, "");
    if (!RECIPES.some((r) => r.id === id)) problems.push(`${dir}/${f}: orphaned, no such recipe`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`${RECIPES.length} recipes — every photo present in ${SIZES.join(" + ")}, every design id recorded.`);
