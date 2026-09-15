import { describe, expect, it } from "vitest";
import {
  SESSION_POOL,
  DROPPED_FROM_POOL,
  buildSession,
  prescribeSlugs,
  sessionPlan,
  swapBlock,
  type Focus,
} from "../../../supabase/functions/_shared/session-builder";
import { PRIORITY_SLUGS } from "../../../supabase/functions/_shared/illustrated-catalog";
import { EXERCISE_CATALOG } from "../../../supabase/functions/_shared/exercise-catalog";
import { bannedSlugs, type InjuryTag } from "../../../supabase/functions/_shared/program-safety";

type Input = Parameters<typeof buildSession>[0];
const base: Omit<Input, "focus"> = {
  minutes: 45,
  goal: "hypertrophy",
  experience: "experienced",
  equipment: ["full_gym"],
  injuries: new Set<InjuryTag>(),
  seed: "t",
};
const build = (focus: Focus[], over: Partial<Omit<Input, "focus">> = {}) => buildSession({ ...base, ...over, focus });
const patternOf = (slug: string) => SESSION_POOL[slug].pattern;

describe("session builder", () => {
  it("classifies every drawable movement, minus the one deliberately dropped", () => {
    const covered = [...Object.keys(SESSION_POOL), ...DROPPED_FROM_POOL].sort();
    expect(covered).toEqual([...PRIORITY_SLUGS].sort());
    for (const slug of Object.keys(SESSION_POOL)) {
      expect(EXERCISE_CATALOG.some((e) => e.slug === slug), slug).toBe(true);
    }
  });

  it("back + biceps in 45 min leads with a pull and never repeats a pattern in the first pass", () => {
    const day = build(["back", "biceps"]);
    expect(day.blocks.length).toBeGreaterThanOrEqual(5);
    expect(["vertical_pull", "horizontal_pull"]).toContain(patternOf(day.blocks[0].slug));
    const patterns = day.blocks.map((b) => patternOf(b.slug));
    // the first five are the strict pass: distinct patterns
    expect(new Set(patterns.slice(0, 5)).size).toBe(5);
    expect(day.focus).toBe("Back & Biceps");
    const plan = sessionPlan(day, 2);
    expect(plan.weeks[0].days).toHaveLength(7);
    expect(plan.weeks[0].days[2].blocks.length).toBe(day.blocks.length);
    plan.weeks[0].days.forEach((d, i) => {
      if (i !== 2) expect(d).toMatchObject({ focus: "Rest", duration_min: 0, blocks: [] });
    });
  });

  it("a knee injury never prescribes what program-safety bans for it", () => {
    const injuries = new Set<InjuryTag>(["knee"]);
    const banned = bannedSlugs(EXERCISE_CATALOG, injuries, "experienced");
    const day = build(["legs", "glutes"], { minutes: 60, injuries });
    expect(day.blocks.length).toBeGreaterThanOrEqual(2);
    for (const b of day.blocks) expect(banned.has(b.slug), b.slug).toBe(false);
  });

  it("someone who has never trained gets no barbell lead and an easier RPE", () => {
    const day = build(["chest", "back"], { minutes: 60, experience: "never_trained" });
    const byslug = new Map(EXERCISE_CATALOG.map((e) => [e.slug, e]));
    for (const b of day.blocks) {
      const tier = SESSION_POOL[b.slug].tier;
      if (tier < 3) {
        expect(byslug.get(b.slug)?.equipment, b.slug).not.toBe("barbell");
        expect(b.rpe).toBe(7);
      }
    }
  });

  it("fits the minutes asked for, and a long session grows in sets before movements", () => {
    let prevSets = 0;
    for (const minutes of [30, 45, 60, 75, 90]) {
      const day = build(["legs"], { minutes });
      expect(Math.abs(day.duration_min - minutes), `${minutes} min`).toBeLessThanOrEqual(5);
      expect(day.blocks.length).toBeGreaterThanOrEqual(3);
      const sets = day.blocks.reduce((t, b) => t + b.sets, 0);
      expect(sets, `${minutes} min sets`).toBeGreaterThan(prevSets);
      prevSets = sets;
    }
    const long = build(["chest", "back", "legs"], { minutes: 90 });
    expect(long.blocks.length).toBeLessThanOrEqual(10);
    expect(long.blocks.filter((b) => SESSION_POOL[b.slug].tier === 1).length).toBeLessThanOrEqual(3);
  });

  it("swaps a movement for a sibling of the same pattern that is not already in the session", () => {
    const day = build(["back", "biceps"]);
    const exclude = day.blocks.map((b) => b.slug);
    const first = day.blocks[0];
    const alt = swapBlock({ ...base, focus: ["back", "biceps"], current: first.slug, exclude });
    expect(alt).not.toBeNull();
    expect(exclude).not.toContain(alt!.slug);
    expect(patternOf(alt!.slug)).toBe(patternOf(first.slug));
    expect(alt!.sets).toBeGreaterThanOrEqual(2);
    // a grown session hands its sets to the replacement, within the cap
    const grown = swapBlock({ ...base, focus: ["back", "biceps"], current: first.slug, exclude, sets: 5 });
    expect(grown!.sets).toBe(Math.min(5, alt!.sets + 2));
    expect(swapBlock({ ...base, focus: ["back"], current: "Not_A_Movement", exclude: [] })).toBeNull();
  });

  it("re-prescribes a slug list the way it built it, and drops what the pool refuses", () => {
    const day = build(["legs"], { minutes: 75 });
    const again = prescribeSlugs([...day.blocks.map((b) => b.slug), "Not_A_Movement"], { ...base, minutes: 75, focus: ["legs"] });
    expect(again).toEqual(day.blocks);
  });

  it("is stable for a seed and different for another", () => {
    expect(build(["chest", "triceps"])).toEqual(build(["chest", "triceps"]));
    const a = build(["chest", "triceps"]).blocks.map((b) => b.slug).join("|");
    const b = build(["chest", "triceps"], { seed: "u" }).blocks.map((b) => b.slug).join("|");
    expect(a).not.toBe(b);
  });
});
