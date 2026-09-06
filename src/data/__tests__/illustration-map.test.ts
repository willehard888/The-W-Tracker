import { describe, expect, it } from "vitest";
import { ILLUSTRATION_BY_CATALOG, PRIORITY_SLUGS } from "@/data/illustration-map";
import { ILLUSTRATED_EXERCISES } from "@/data/exercises-illustrated";
import { EXERCISE_CATALOG } from "../../../supabase/functions/_shared/exercise-catalog";
import { resolveIllustration } from "@/lib/exercise-match";

const catalog = new Set(EXERCISE_CATALOG.map((e) => e.slug));
const illustrated = new Set(ILLUSTRATED_EXERCISES.map((e) => e.slug));

describe("illustration map", () => {
  it("keys are catalog slugs the generator can actually pick", () => {
    const unknown = Object.keys(ILLUSTRATION_BY_CATALOG).filter((k) => !catalog.has(k));
    expect(unknown).toEqual([]);
  });
  it("values are illustrated movements", () => {
    const unknown = Object.values(ILLUSTRATION_BY_CATALOG).filter((v) => !illustrated.has(v));
    expect([...new Set(unknown)]).toEqual([]);
  });
  it("resolves through the shared resolver for every priority slug", () => {
    for (const slug of PRIORITY_SLUGS) {
      const item = EXERCISE_CATALOG.find((e) => e.slug === slug)!;
      expect(resolveIllustration(slug, item.name)?.slug, slug).toBe(ILLUSTRATION_BY_CATALOG[slug]);
    }
  });
  it("still resolves an unmapped movement by exact title, and nothing for nonsense", () => {
    expect(resolveIllustration("Nope_Nothing", "Barbell Squat")?.slug).toBe("barbell-squat");
    expect(resolveIllustration(undefined, "Kettlebell Nonsense Flip")).toBeNull();
  });
});
