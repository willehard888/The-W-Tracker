import { describe, it, expect } from "vitest";
import { LOWER_BODY_COACHING } from "@/data/coaching/lower-body";
import { UPPER_BODY_COACHING } from "@/data/coaching/upper-body";
import { EXERCISE_COACHING } from "@/data/exercise-coaching";
import { ILLUSTRATED_EXERCISES } from "@/data/exercises-illustrated";

/**
 * Locks the lower-body coaching set.
 *
 * The 32 slugs are listed here on purpose: the generator prescribes these
 * movements (src/data/illustration-map.ts), so a missing entry means an
 * athlete gets a drawing with no technique next to it — and nothing else
 * would say so. The tone lint is the house rule made executable: this text
 * ships under "Educational guidance — not medical advice".
 */

const TARGETS = [
  "front-squat-with-barbell",
  "wide-stance-squat-with-barbell",
  "narrow-stance-squat-with-barbell",
  "hack-squat-with-barbell",
  "hack-squat-machine",
  "narrow-stance-hack-squats",
  "smith-machine-squats",
  "squats-using-dumbbells",
  "squat-to-bench-with-dumbbells",
  "pile-squat-with-dumbbell",
  "jefferson-squats-with-barbell",
  "squats-with-exercise-bands",
  "narrow-stance-leg-press",
  "leg-extensions",
  "lying-leg-curl-machine",
  "rear-lunges-with-dumbbell",
  "barbell-lunges",
  "step-ups-with-barbell",
  "barbell-dead-lifts",
  "barbell-good-mornings",
  "standing-barbell-calf-raise",
  "smith-machine-reverse-calf-raises",
  "one-legged-cable-kickback",
  "thigh-abductor",
  "thigh-adductor",
  "cross-body-crunch",
  "decline-crunch",
  "decline-oblique-crunch",
  "bent-knee-hip-raise",
  "flutter-kicks",
  "air-bike",
  "ab-rollout-with-barbell",
];

/** The hand-written set in exercise-coaching.ts. A group file must never shadow one of these. */
const CORE_SLUGS = [
  "barbell-squat",
  "romanian-dead-lift",
  "bench-press",
  "push-ups",
  "body-row",
  "leg-press",
  "seated-leg-curl",
  "seated-military-press",
  "seated-cable-rows",
  "v-bar-pull-down",
  "pull-ups",
  "dumbbell-lunges",
  "step-ups-with-dumbbells",
  "crunches",
];

const TONE_LINT = /pain-free|cure|guarantee|medical|physio|injur(y|ies) will|rehab/i;

const allText = (slug: string): string[] => {
  const c = LOWER_BODY_COACHING[slug];
  return [
    ...c.setup,
    ...c.cues,
    c.tempo,
    c.breathing,
    ...c.mistakes.flatMap((m) => [m.error, m.fix]),
    c.feelIt,
    c.easier,
    c.harder,
  ];
};

describe("lower-body coaching", () => {
  it("covers every prescribable lower-body movement", () => {
    const missing = TARGETS.filter((s) => !LOWER_BODY_COACHING[s]);
    expect(missing, `no coaching for: ${missing.join(", ")}`).toEqual([]);
    expect(Object.keys(LOWER_BODY_COACHING).sort()).toEqual([...TARGETS].sort());
  });

  it("is keyed by slugs that exist in the illustrated set", () => {
    const slugs = new Set(ILLUSTRATED_EXERCISES.map((e) => e.slug));
    const orphans = Object.keys(LOWER_BODY_COACHING).filter((s) => !slugs.has(s));
    expect(orphans, `no illustrated exercise for: ${orphans.join(", ")}`).toEqual([]);
  });

  it("makes no medical claims and no promises", () => {
    for (const slug of Object.keys(LOWER_BODY_COACHING)) {
      for (const line of allText(slug)) {
        expect(line, `${slug}: "${line}"`).not.toMatch(TONE_LINT);
      }
    }
  });

  it("gives a usable fix for every mistake, and one short thought under load", () => {
    for (const [slug, c] of Object.entries(LOWER_BODY_COACHING)) {
      expect(c.mistakes.length, `${slug} lists fewer than two mistakes`).toBeGreaterThanOrEqual(2);
      for (const m of c.mistakes) {
        expect(m.fix.length, `${slug}: "${m.error}" fix is too short to act on`).toBeGreaterThanOrEqual(20);
      }
      expect(c.cues[0].length, `${slug}: first cue is too long to hold in your head`).toBeLessThanOrEqual(90);
      for (const line of allText(slug)) {
        expect(line.trim().length, `${slug} has an empty string`).toBeGreaterThan(0);
      }
    }
  });

  it("adds to the core set without shadowing any of it", () => {
    const shadowed = Object.keys(LOWER_BODY_COACHING).filter((s) => CORE_SLUGS.includes(s));
    expect(shadowed, `already written in exercise-coaching.ts: ${shadowed.join(", ")}`).toEqual([]);
    for (const s of CORE_SLUGS) expect(EXERCISE_COACHING[s], `core entry ${s} is missing`).toBeDefined();
    expect(Object.keys(EXERCISE_COACHING).length).toBe(
      CORE_SLUGS.length + Object.keys(LOWER_BODY_COACHING).length + Object.keys(UPPER_BODY_COACHING).length,
    );
  });
});
