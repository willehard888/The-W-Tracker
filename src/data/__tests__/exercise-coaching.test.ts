import { describe, it, expect } from "vitest";
import { EXERCISE_COACHING, coachingFor } from "@/data/exercise-coaching";
import { ILLUSTRATED_EXERCISES } from "@/data/exercises-illustrated";

/**
 * Locks the coaching contract.
 *
 * The failure this guards against is the one that has already happened twice
 * in this repo: content keyed by one exercise vocabulary, rendered next to a
 * picture drawn from another, joining on a name. Coaching written for a slug
 * that does not exist would simply never appear, and nothing would say so.
 *
 * The content assertions matter for a different reason. These strings are
 * technique cues for beginners — an entry that shipped with an empty `fix`
 * would name a mistake and then leave the athlete with no answer.
 */

const slugs = new Set(ILLUSTRATED_EXERCISES.map((e) => e.slug));

describe("exercise coaching", () => {
  it("is written for exercises that actually exist", () => {
    const orphans = Object.keys(EXERCISE_COACHING).filter((s) => !slugs.has(s));
    expect(orphans, `no illustrated exercise for: ${orphans.join(", ")}`).toEqual([]);
  });

  it("never names a mistake without giving the fix", () => {
    for (const [slug, c] of Object.entries(EXERCISE_COACHING)) {
      expect(c.mistakes.length, `${slug} lists no mistakes`).toBeGreaterThan(0);
      for (const m of c.mistakes) {
        expect(m.error.trim().length, `${slug} has an empty error`).toBeGreaterThan(0);
        expect(m.fix.trim().length, `${slug}: "${m.error}" has no fix`).toBeGreaterThan(0);
      }
    }
  });

  it("fills every field — a half-written entry renders as a blank heading", () => {
    for (const [slug, c] of Object.entries(EXERCISE_COACHING)) {
      for (const [key, value] of Object.entries({
        tempo: c.tempo,
        breathing: c.breathing,
        feelIt: c.feelIt,
        easier: c.easier,
        harder: c.harder,
      })) {
        expect(value.trim().length, `${slug}.${key} is empty`).toBeGreaterThan(0);
      }
      for (const [key, list] of Object.entries({ setup: c.setup, cues: c.cues })) {
        expect(list.length, `${slug}.${key} is empty`).toBeGreaterThan(0);
        for (const line of list) {
          expect(line.trim().length, `${slug}.${key} has an empty line`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("returns nothing for the exercises still without coaching", () => {
    // Coverage is deliberately partial; the UI has to be able to tell.
    expect(coachingFor(undefined)).toBeUndefined();
    expect(coachingFor("a-slug-that-does-not-exist")).toBeUndefined();
    const uncovered = ILLUSTRATED_EXERCISES.find((e) => !EXERCISE_COACHING[e.slug]);
    expect(coachingFor(uncovered?.slug)).toBeUndefined();
  });
});
