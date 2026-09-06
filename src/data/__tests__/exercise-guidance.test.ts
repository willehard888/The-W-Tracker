import { describe, it, expect } from "vitest";
import { ILLUSTRATED_EXERCISES, illustrationThumb } from "@/data/exercises-illustrated";

/**
 * Locks the guidance contract behind the exercise surfaces.
 *
 * The bug these guard against: ExerciseRow drew its picture from the
 * ILLUSTRATED set and its text from the 542-photo set, and only 40 of 269
 * titles match exactly across the two. For the other 229 the row rendered a
 * beautiful illustration and no instructions at all — mid-workout, which is
 * the one moment the cue matters. The row now falls back to the illustrated
 * `steps`, so those steps have to actually be there for every entry.
 */
describe("illustrated exercise library", () => {
  it("has a unique slug for every entry", () => {
    expect(new Set(ILLUSTRATED_EXERCISES.map((e) => e.slug)).size).toBe(ILLUSTRATED_EXERCISES.length);
  });

  it("never draws one illustration for two movements", () => {
    // Upstream shipped 0020 for both the band back fly and "Tate Press"; the
    // generator drops the duplicate (the lying dumbbell press is 0203).
    const seen = new Set<string>();
    const dupes = ILLUSTRATED_EXERCISES.filter((e) => {
      if (seen.has(e.idNum)) return true;
      seen.add(e.idNum);
      return false;
    });
    expect(dupes.map((e) => e.slug)).toEqual([]);
  });

  it("gives every exercise steps to fall back to", () => {
    for (const ex of ILLUSTRATED_EXERCISES) {
      expect(ex.steps.length, `${ex.slug} has no steps`).toBeGreaterThan(0);
      for (const step of ex.steps) {
        expect(step.trim().length, `${ex.slug} has an empty step`).toBeGreaterThan(0);
      }
    }
  });

  it("can render a thumbnail and both technique states for every exercise", () => {
    for (const ex of ILLUSTRATED_EXERCISES) {
      // Both states drive the rep animation; a missing idNum would leave the
      // player cross-fading between two broken images.
      expect(ex.idNum, `${ex.slug} has no idNum`).toBeTruthy();
      expect(illustrationThumb(ex.idNum)).toMatch(/^\/illustrations\/.+\.webp$/);
    }
  });

  it("names a primary muscle for every entry, so the group filter can reach it", () => {
    const unreachable = ILLUSTRATED_EXERCISES.filter((e) => e.primary.length === 0).map((e) => e.slug);
    expect(unreachable).toEqual([]);
  });
});
