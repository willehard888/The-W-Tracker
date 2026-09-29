import { describe, expect, it } from "vitest";
import {
  SESSION_POOL,
  SCHEMES,
  LOAD_CLASSES,
  ACCESSORY,
  HEAVY,
  loadClassOf,
  raiseReps,
  buildSession,
  type Focus,
} from "../../../supabase/functions/_shared/session-builder";
import { EXERCISE_CATALOG } from "../../../supabase/functions/_shared/exercise-catalog";
import type { InjuryTag } from "../../../supabase/functions/_shared/program-safety";

/**
 * The dose, and the minutes it is spent in.
 *
 * A member ran a real workout and every movement in it read 4 × 5-8 at RPE 8
 * with two minutes' rest — a rear delt row and an upright row among them.
 * Reproduced against the live builder before any of this was written:
 * Chest & Legs & Shoulders at 60 minutes came back as five compounds and no
 * accessory work at all; 75 minutes came back as six. Adding time made it
 * worse, which is the opposite of what anybody expects.
 *
 * Two causes, and each needs its own hold-down. The dose was `tier < 3` — one
 * bit for a question that is not binary, so a bench press and a rear delt row
 * were the same prescription. And the budget was spent in tier order, so the
 * heavy end hit the ceiling before tier 3 was considered at all.
 */

type Input = Parameters<typeof buildSession>[0];
const base: Omit<Input, "focus"> = {
  minutes: 45,
  goal: "hypertrophy",
  experience: "experienced",
  equipment: ["full_gym"],
  injuries: new Set<InjuryTag>(),
  seed: "t",
};
const build = (focus: Focus[], over: Partial<Omit<Input, "focus">> = {}) =>
  buildSession({ ...base, ...over, focus });

const GOALS = ["all", "strength", "hypertrophy", "fat_loss", "endurance", "longevity", "focus"];
const lowEnd = (reps: string) => parseInt(String(reps).split("-")[0], 10);
const classOf = (slug: string) => loadClassOf(SESSION_POOL[slug]);

describe("the dose fits the movement", () => {
  it("an hour of chest, legs and shoulders is not five sets of five-to-eight", () => {
    // The member's exact session, focus for focus and minute for minute.
    const day = build(["chest", "legs", "shoulders"], { minutes: 60, goal: "all" });
    const ranges = new Set(day.blocks.map((b) => String(b.reps)));
    expect(ranges.size, `every movement got the same range: ${[...ranges].join(", ")}`).toBeGreaterThan(1);
    expect(
      day.blocks.some((b) => ACCESSORY.has(classOf(b.slug))),
      "not one accessory movement survived the hour",
    ).toBe(true);
  });

  it("a rear delt row is never dosed like a bench press", () => {
    expect(classOf("Barbell_Rear_Delt_Row"), "a row built for the rear delts").toBe("small_compound");
    for (const goal of GOALS) {
      const s = SCHEMES[goal];
      expect(s.small_compound.reps, goal).not.toBe(s.lead.reps);
      expect(s.small_compound.rest_sec, `${goal}: rest`).toBeLessThan(s.lead.rest_sec);
    }
  });

  it("every upright row variant reads as small-joint work", () => {
    const uprights = Object.keys(SESSION_POOL).filter((s) => /Upright.*Row/i.test(s));
    expect(uprights.length, "the pool still holds upright rows").toBeGreaterThan(0);
    for (const slug of uprights) expect(classOf(slug), slug).toBe("small_compound");
  });

  it("gives a lateral raise at least as many reps as a chest fly, for every goal", () => {
    for (const goal of GOALS) {
      const s = SCHEMES[goal];
      expect(lowEnd(s.isolation_small.reps), `${goal}: small muscles take reps`)
        .toBeGreaterThanOrEqual(lowEnd(s.isolation.reps));
    }
  });

  it("never climbs in reps as the load class gets heavier", () => {
    const order = ["lead", "compound", "small_compound", "isolation"] as const;
    for (const goal of GOALS) {
      const lows = order.map((c) => lowEnd(SCHEMES[goal][c].reps));
      for (let i = 1; i < lows.length; i++) {
        expect(lows[i], `${goal}: ${order[i]} vs ${order[i - 1]}`).toBeGreaterThanOrEqual(lows[i - 1]);
      }
    }
  });

  it("names every load class for every goal", () => {
    // A half-filled table would hand somebody `undefined.sets` mid-session.
    for (const goal of GOALS) {
      for (const cls of LOAD_CLASSES) {
        const rx = SCHEMES[goal]?.[cls];
        expect(rx, `${goal}.${cls}`).toBeDefined();
        expect(rx.sets, `${goal}.${cls}: sets`).toBeGreaterThan(0);
        expect(String(rx.reps), `${goal}.${cls}: reps`).toMatch(/^\d+(-\d+)?$/);
      }
    }
  });

  it("doses a movement outside the pool from its mechanic, and never as a lead", () => {
    const outside = EXERCISE_CATALOG.filter((e) => !SESSION_POOL[e.slug]);
    expect(outside.length, "the catalog is wider than the pool").toBeGreaterThan(0);
    for (const e of outside) {
      const cls = loadClassOf(e);
      expect(cls, `${e.slug}: without a tier we cannot know it is a lead`).not.toBe("lead");
      expect(LOAD_CLASSES, e.slug).toContain(cls);
    }
  });

  it("never sends somebody who has never trained to five reps", () => {
    for (const goal of GOALS) {
      const day = build(["chest", "back"], { goal, experience: "never_trained", minutes: 60 });
      for (const b of day.blocks) {
        expect(lowEnd(String(b.reps)), `${goal}: ${b.name} at ${b.reps}`).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("raises a range by its low end and carries the span", () => {
    expect(raiseReps("3-5", 8)).toBe("8-10");
    expect(raiseReps("10-12", 8), "already above the floor").toBe("10-12");
    expect(raiseReps("5", 8), "a single number has no span").toBe("8");
    expect(raiseReps("6-10", 0), "no floor, no change").toBe("6-10");
  });
});

/**
 * The composition half — the matrix that would have caught the original
 * report. It was never one session that was wrong; it was every session at an
 * hour or more, on any focus whose compounds span several patterns.
 */
describe("accessory work survives the minutes", () => {
  const FOCI: Focus[][] = [
    ["chest", "legs", "shoulders"],
    ["chest", "back", "shoulders"],
    ["back", "biceps"],
    ["legs"],
    ["chest", "triceps"],
  ];
  const MATRIX_GOALS = ["all", "hypertrophy", "strength", "fat_loss"];
  const count = (day: { blocks: { slug: string }[] }, set: ReadonlySet<string>) =>
    day.blocks.filter((b) => set.has(classOf(b.slug))).length;

  it("carries accessory work at an hour and above, on every focus and goal", () => {
    // An hour is where the reported bug lived and where the guarantee holds.
    for (const focus of FOCI) {
      for (const minutes of [60, 75, 90]) {
        for (const goal of MATRIX_GOALS) {
          const day = build(focus, { minutes, goal });
          expect(count(day, ACCESSORY), `${focus.join("+")} · ${minutes}min · ${goal}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("spends a short strength session on the main lifts, and says so by doing it", () => {
    // Not a gap. Strength rests three minutes, so one lead costs 21 of the 45
    // minutes on offer; two main lifts and nothing else is what 45 minutes of
    // strength work actually is. The reserve is clamped so it can never take
    // those two, which is the tradeoff made deliberately here.
    const day = build(["chest", "legs", "shoulders"], { minutes: 45, goal: "strength" });
    expect(count(day, HEAVY), "the main lifts survive a short strength day").toBeGreaterThanOrEqual(2);
  });

  it("keeps two heavy lifts in every one of them", () => {
    for (const focus of FOCI) {
      for (const minutes of [45, 60, 75, 90]) {
        for (const goal of MATRIX_GOALS) {
          const day = build(focus, { minutes, goal });
          expect(count(day, HEAVY), `${focus.join("+")} · ${minutes}min · ${goal}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("never spends longer than the athlete asked for", () => {
    // The over-run is the failure that matters: an athlete who asked for an
    // hour and is handed seventy-five minutes of work has been lied to.
    for (const focus of FOCI) {
      for (const minutes of [30, 45, 60, 75, 90]) {
        for (const goal of MATRIX_GOALS) {
          const day = build(focus, { minutes, goal });
          expect(
            day.duration_min - minutes,
            `${focus.join("+")} · ${minutes}min · ${goal} → ${day.duration_min}min`,
          ).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it("under-runs only where the movements run out before the minutes do", () => {
    // A pre-existing limit, not a regression: this fails identically with the
    // accessory reserve switched off. One muscle group, ninety minutes and
    // fat-loss rests means the pattern caps run out of distinct movements
    // long before the budget does. Pinned so it cannot quietly get worse, and
    // left alone because widening it is a different piece of work.
    const KNOWN_SHORTFALL = 15;
    for (const focus of FOCI) {
      for (const minutes of [30, 45, 60, 75, 90]) {
        for (const goal of MATRIX_GOALS) {
          const day = build(focus, { minutes, goal });
          expect(
            minutes - day.duration_min,
            `${focus.join("+")} · ${minutes}min · ${goal} → ${day.duration_min}min`,
          ).toBeLessThanOrEqual(KNOWN_SHORTFALL);
        }
      }
    }
  });

  it("still presses overhead on an upper day at sixty minutes", () => {
    // Two tier-1 pulls used to spend the lead budget before the press was
    // reached, and the day finished with no vertical push in it at all.
    const day = build(["chest", "back", "shoulders"], { minutes: 60, goal: "all" });
    const patterns = day.blocks.map((b) => SESSION_POOL[b.slug].pattern);
    expect(patterns, `got ${patterns.join(", ")}`).toContain("vertical_push");
  });
});
