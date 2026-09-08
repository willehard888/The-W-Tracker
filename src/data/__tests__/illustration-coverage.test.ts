import { describe, it, expect } from "vitest";
import { ILLUSTRATION_BY_CATALOG } from "@/data/illustration-map";
import { ILLUSTRATED_EXERCISES } from "@/data/exercises-illustrated";
import { resolveIllustration } from "@/lib/exercise-match";
import { EXERCISE_CATALOG, filterCatalog } from "../../../supabase/functions/_shared/exercise-catalog";
import { PRIORITY_SLUGS } from "../../../supabase/functions/_shared/illustrated-catalog";

/**
 * Coverage and correctness of the catalog → illustration table.
 *
 * `illustration-map.test.ts` already checks the table is well-formed — keys are
 * catalog slugs, values are drawings, priority slugs resolve. This file guards
 * the thing that is far easier to get wrong: a row that resolves cleanly and
 * shows the WRONG movement.
 *
 * That is not hypothetical. `Barbell_Glute_Bridge` was mapped to "bridging",
 * which resolves, renders, and is a bodyweight floor bridge — a different
 * exercise from a loaded hip bridge. Nothing failed. A member would simply have
 * watched the wrong demonstration. The equipment check below is what found it.
 */

/** Catalog equipment word → how the illustrated set spells the same thing. */
const EQUIVALENT: Record<string, string[]> = {
  barbell: ["barbell", "olympic bar", "ez bar", "weight", "smith machine", "t-bar machine"],
  dumbbell: ["dumbbell", "weight"],
  cable: ["cable", "machine"],
  machine: ["machine", "cable", "t-bar machine", "leg machine", "smith machine"],
  bodyweight: ["body", "bench", "pullup bar", "dip bar", "stability ball", "bosu", "dome"],
  bands: ["band", "exercise band", "bands"],
  kettlebells: ["kettlebell", "weight"],
  "e-z curl bar": ["barbell", "ez bar"],
  "exercise ball": ["stability ball", "exercise ball", "body"],
  "medicine ball": ["medicine ball", "weight"],
  other: [],
};

const catalogBySlug = new Map(EXERCISE_CATALOG.map((c) => [c.slug, c]));
const drawingBySlug = new Map(ILLUSTRATED_EXERCISES.map((e) => [e.slug, e]));

describe("illustration mapping — the drawing must be the same exercise", () => {
  it("never shows a movement performed with different equipment", () => {
    const mismatched: string[] = [];
    for (const [catalogSlug, drawingSlug] of Object.entries(ILLUSTRATION_BY_CATALOG)) {
      const c = catalogBySlug.get(catalogSlug);
      const d = drawingBySlug.get(drawingSlug);
      if (!c || !d) continue; // shape is illustration-map.test.ts's job
      const allowed = EQUIVALENT[c.equipment] ?? [];
      // An untagged drawing is not evidence of a mismatch, so it passes here.
      const ok =
        d.equipment.length === 0 ||
        d.equipment.some((have) =>
          allowed.some((a) => have.toLowerCase().includes(a) || a.includes(have.toLowerCase())));
      if (!ok) {
        mismatched.push(
          `"${c.name}" (${c.equipment}) → "${d.title}" (${d.equipment.join(", ")})`);
      }
    }
    expect(
      mismatched,
      `these rows demonstrate the movement with the wrong equipment:\n  ${mismatched.join("\n  ")}`,
    ).toEqual([]);
  });

  // There is deliberately NO "primary muscle must match" test here, and it is
  // worth saying why: it was written, and it failed on rows that are correct.
  // The catalog calls a lunge quadriceps, the illustrated set calls the same
  // lunge hamstrings; "Dumbbell Lunges" → "Dumbbell Lunges" tripped it. The two
  // datasets use different taxonomies, so the check measures a classification
  // disagreement rather than a wrong movement. Widening its allowlist until it
  // passed would have left a test that permits real errors while teaching
  // everyone to ignore it. Equipment is the signal that actually discriminates.

  it("references only drawings that have an image to load", () => {
    // A row pointing at a drawing with no idNum renders an empty frame.
    for (const drawingSlug of Object.values(ILLUSTRATION_BY_CATALOG)) {
      const d = drawingBySlug.get(drawingSlug);
      if (!d) continue;
      expect(d.idNum, `${drawingSlug} has no image id`).toBeTruthy();
    }
  });
});

describe("illustration coverage — the numbers, so a regression is visible", () => {
  const drawable = EXERCISE_CATALOG.filter((c) => !!resolveIllustration(c.slug, c.name));
  const offered = filterCatalog(
    ["barbell", "dumbbells", "machines", "cable", "bench", "pullup_bar", "bodyweight", "kettlebell", "bands"],
    200,
    { priority: PRIORITY_SLUGS, only: new Set(PRIORITY_SLUGS) },
  );

  it("every movement the generator can prescribe has a drawing", () => {
    // The guarantee the whole thing exists for: a session cannot mix a rep
    // animation with something that has no picture at all.
    const undrawn = offered.filter((c) => !resolveIllustration(c.slug, c.name));
    expect(
      undrawn.map((c) => c.name),
      "the generator is offering movements it cannot demonstrate",
    ).toEqual([]);
  });

  it("keeps enough drawable movements to build a real program", () => {
    // A floor, not a target. If a refactor quietly halves the table, the
    // programs get worse long before anyone notices the pictures are gone.
    expect(drawable.length).toBeGreaterThanOrEqual(150);
    expect(offered.length).toBeGreaterThanOrEqual(60);
  });

  it("covers every major movement pattern the generator needs", () => {
    // Program quality, not coverage vanity: a pool with no rowing movement
    // produces a program with no rowing movement.
    const need: Record<string, number> = {
      chest: 3, quadriceps: 3, hamstrings: 1, "middle back": 1,
      lats: 1, shoulders: 3, biceps: 3, triceps: 3, abdominals: 2, calves: 1,
    };
    const have: Record<string, number> = {};
    for (const c of drawable) have[c.primary] = (have[c.primary] ?? 0) + 1;
    const thin = Object.entries(need)
      .filter(([m, n]) => (have[m] ?? 0) < n)
      .map(([m, n]) => `${m}: ${have[m] ?? 0} drawable, need ${n}`);
    expect(thin, `too few drawable movements to program well:\n  ${thin.join("\n  ")}`).toEqual([]);
  });
});
