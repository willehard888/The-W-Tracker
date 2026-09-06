import { describe, it, expect } from "vitest";
import { UPPER_BODY_COACHING } from "@/data/coaching/upper-body";
import { EXERCISE_COACHING } from "@/data/exercise-coaching";
import { ILLUSTRATED_EXERCISES } from "@/data/exercises-illustrated";

/**
 * Locks the upper-body coaching stream.
 *
 * The 50 slugs are listed here on purpose: a missing entry should fail
 * loudly, by name, not disappear into "the object is smaller". The tone lint
 * is the house rules turned into a regex — no medical or physiotherapy
 * claims, no promises about pain. The shape checks catch the half-written
 * entry that renders as a heading with nothing under it.
 */

const TARGETS = [
  "wide-grip-bench-press",
  "close-grip-barbell-bench-press",
  "barbell-neck-press",
  "incline-bench-press",
  "decline-barbell-bench-press",
  "wide-grip-decline-bench-press",
  "reverse-triceps-bench-press-with-barbell",
  "bench-press-dumbbell",
  "incline-dumbbell-press",
  "hammer-grip-incline-bench-press",
  "decline-dumbbell-bench-press",
  "one-arm-bench-press",
  "one-arm-barbell-floor-press",
  "machine-bench-press",
  "decline-chest-press",
  "smith-machine-bench-press",
  "smith-machine-incline-bench-press",
  "smith-machine-close-grip-bench-press",
  "push-up-feet-elevated",
  "bench-dips",
  "cable-crossover",
  "jm-press",
  "one-arm-dumbbell-shoulder-press",
  "t-bar-rows",
  "reverse-grips-bent-over-barbell-rows",
  "rear-deltoid-row-barbell",
  "upright-barbell-rows",
  "upright-cable-row",
  "smith-machine-upright-row",
  "one-arm-upright-row",
  "underhand-pull-downs",
  "front-dumbbell-raise",
  "lying-rear-lateral-raise",
  "lying-one-arm-rear-lateral-raise",
  "internal-cable-rotation",
  "high-cable-curls",
  "drag-curl-with-barbell",
  "reverse-grip-triceps-pushdown",
  "decline-close-grip-bench-to-skull-crusher",
  "standing-overhead-triceps-extension-with-barbell",
  "one-arm-triceps-extension-with-dumbbell",
  "bent-over-one-arm-triceps-extension-with-dumbbell",
  "bent-over-two-arm-triceps-extension-with-dumbbell",
  "one-arm-low-pulley-triceps-extension-with-cable",
  "standing-triceps-extension-with-towel",
  "bent-arm-pullover",
  "dumbbell-bent-arm-pullover",
  "straight-arm-dumbbell-pullover",
  "wide-grip-decline-barbell-pullover",
  "barbell-front-raise-pullover",
];

const TONE = /pain-free|cure|guarantee|medical|physio|injur(y|ies) will|rehab/i;

const slugs = new Set(ILLUSTRATED_EXERCISES.map((e) => e.slug));

/** Every string in an entry, flattened, so one loop can lint all of it. */
const textOf = (c: (typeof UPPER_BODY_COACHING)[string]): string[] => [
  ...c.setup,
  ...c.cues,
  c.tempo,
  c.breathing,
  ...c.mistakes.flatMap((m) => [m.error, m.fix]),
  c.feelIt,
  c.easier,
  c.harder,
];

describe("upper-body coaching", () => {
  it("covers every one of the 50 targets, and nothing else", () => {
    expect(TARGETS).toHaveLength(50);
    expect(new Set(TARGETS).size).toBe(50);
    const missing = TARGETS.filter((s) => !UPPER_BODY_COACHING[s]);
    expect(missing, `no entry for: ${missing.join(", ")}`).toEqual([]);
    const extra = Object.keys(UPPER_BODY_COACHING).filter((s) => !TARGETS.includes(s));
    expect(extra, `entries outside the target list: ${extra.join(", ")}`).toEqual([]);
  });

  it("is keyed by slugs that exist in the illustrated library", () => {
    const orphans = Object.keys(UPPER_BODY_COACHING).filter((s) => !slugs.has(s));
    expect(orphans, `no illustrated exercise for: ${orphans.join(", ")}`).toEqual([]);
  });

  it("keeps to the house tone — no medical, physio or pain claims", () => {
    for (const [slug, c] of Object.entries(UPPER_BODY_COACHING)) {
      for (const line of textOf(c)) {
        expect(TONE.test(line), `${slug}: "${line}"`).toBe(false);
      }
    }
  });

  it("has the shape a beginner can act on", () => {
    for (const [slug, c] of Object.entries(UPPER_BODY_COACHING)) {
      expect(c.mistakes.length, `${slug} needs at least two mistakes`).toBeGreaterThanOrEqual(2);
      for (const m of c.mistakes) {
        expect(m.fix.length, `${slug}: fix too short for "${m.error}"`).toBeGreaterThanOrEqual(20);
      }
      expect(c.cues[0].length, `${slug}: cues[0] over 90 chars`).toBeLessThanOrEqual(90);
      for (const line of textOf(c)) {
        expect(line.trim().length, `${slug} has an empty string`).toBeGreaterThan(0);
      }
    }
  });

  it("does not collide with the core entries when merged", () => {
    const mine = Object.keys(UPPER_BODY_COACHING);
    // A spread would silently overwrite a core key, so the core list is
    // spelled out: the 14 entries in exercise-coaching.ts.
    const core = ["barbell-squat", "romanian-dead-lift", "bench-press", "push-ups", "body-row", "leg-press", "seated-leg-curl", "seated-military-press", "seated-cable-rows", "v-bar-pull-down", "pull-ups", "dumbbell-lunges", "step-ups-with-dumbbells", "crunches"];
    for (const s of core) expect(EXERCISE_COACHING[s], `core entry ${s} missing from merged record`).toBeDefined();
    expect(mine.filter((s) => core.includes(s))).toEqual([]);
    // Every one of mine reaches the merged record unchanged.
    for (const s of mine) expect(EXERCISE_COACHING[s]).toBe(UPPER_BODY_COACHING[s]);
  });
});
