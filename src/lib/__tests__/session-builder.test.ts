import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SESSION_POOL,
  DROPPED_FROM_POOL,
  buildSession,
  buildWeek,
  neglectedFocuses,
  prescribeSlugs,
  primaryFocuses,
  sessionPlan,
  swapBlock,
  swapCandidates,
  weekPlan,
  weekSplit,
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

  it("the one-tap swap is the first of the ranked candidates, same movement before same muscle", () => {
    const day = build(["back", "biceps"]);
    const exclude = day.blocks.map((b) => b.slug);
    const first = day.blocks[0];
    const o = { ...base, focus: ["back", "biceps"] as Focus[], current: first.slug, exclude };
    const ranked = swapCandidates(o);
    expect(ranked.length).toBeGreaterThan(1);
    expect(new Set(ranked.map((e) => e.slug)).size).toBe(ranked.length);
    expect(swapBlock(o)!.slug).toBe(ranked[0].slug);
    const firstOther = ranked.findIndex((e) => e.pattern !== patternOf(first.slug));
    if (firstOther >= 0) expect(ranked.slice(firstOther).every((e) => e.pattern !== patternOf(first.slug) || e.focus[0] !== SESSION_POOL[first.slug].focus[0])).toBe(true);
    expect(swapCandidates({ ...o, current: "Not_A_Movement" })).toEqual([]);
  });

  it("the day's feel changes the dose, never the movements", () => {
    const normal = build(["legs"], { minutes: 60 });
    const light = build(["legs"], { minutes: 60, feel: "light" });
    const hard = build(["legs"], { minutes: 60, feel: "hard" });
    expect(light.blocks.map((b) => b.slug)).toEqual(normal.blocks.map((b) => b.slug));
    expect(hard.blocks.map((b) => b.slug)).toEqual(normal.blocks.map((b) => b.slug));
    normal.blocks.forEach((b, i) => {
      expect(light.blocks[i].sets).toBe(Math.max(2, b.sets - 1));
      expect(light.blocks[i].rpe).toBe(Math.max(5, b.rpe - 1.5));
      expect(hard.blocks[i].rpe).toBe(Math.min(9.5, b.rpe + 1));
      expect(hard.blocks[i].sets).toBe(b.sets);
    });
    expect(light.duration_min).toBeLessThan(normal.duration_min);
    // hard is never offered to someone who has not trained
    const novice = build(["legs"], { minutes: 60, experience: "never_trained" });
    expect(build(["legs"], { minutes: 60, experience: "never_trained", feel: "hard" })).toEqual(novice);
  });

  it("splits a week by the number of training days", () => {
    expect(weekSplit(1).map((d) => d.name)).toEqual(["Full body"]);
    expect(weekSplit(3).map((d) => d.name)).toEqual(["Full body", "Full body", "Full body"]);
    expect(weekSplit(4).map((d) => d.name)).toEqual(["Upper", "Lower", "Upper", "Lower"]);
    expect(weekSplit(5).map((d) => d.name)).toEqual(["Push", "Pull", "Legs", "Upper", "Lower"]);
    expect(weekSplit(6).map((d) => d.name)).toEqual(["Push", "Pull", "Legs", "Push", "Pull", "Legs"]);
    expect(weekSplit(7)).toEqual(weekSplit(6));
    expect(weekSplit(0)).toEqual(weekSplit(1));
  });

  it("builds a week on the athlete's days: deterministic, banned movements out, repeated days different", () => {
    const injuries = new Set<InjuryTag>(["knee"]);
    const banned = bannedSlugs(EXERCISE_CATALOG, injuries, "experienced");
    const o = { ...base, minutes: 45, injuries };
    const week = buildWeek(o, [0, 1, 3, 4]);
    expect(week).toEqual(buildWeek(o, [4, 3, 1, 0, 0]));
    expect(week.map((d) => d?.focus ?? "Rest")).toEqual(["Upper", "Lower", "Rest", "Upper", "Lower", "Rest", "Rest"]);
    for (const d of week) for (const b of d?.blocks ?? []) expect(banned.has(b.slug), b.slug).toBe(false);
    expect(week[0]!.blocks.map((b) => b.slug)).not.toEqual(week[3]!.blocks.map((b) => b.slug));
    // the week's plan and the one-session plan are the same shape
    const plan = weekPlan(week, { theme: "Your week", nutritionNote: "n", progressionNote: "p" });
    expect(plan.weeks[0].days).toHaveLength(7);
    expect(plan.weeks[0].days[2]).toEqual(sessionPlan(week[0]!, 0).weeks[0].days[2]);
    expect(plan.weekly_check_targets.workouts).toBe(4);
    expect(sessionPlan(week[0]!, 0).weekly_check_targets.workouts).toBe(1);
  });

  it("names a hand-built day by the muscles it mostly trains", () => {
    const of = (f: Focus, n: number) => Object.keys(SESSION_POOL).filter((s) => SESSION_POOL[s].focus[0] === f).slice(0, n);
    expect(primaryFocuses([...of("back", 3), ...of("biceps", 2), ...of("core", 1)])).toEqual(["back", "biceps", "core"]);
    // a tie goes to the bigger muscle group
    expect(primaryFocuses([...of("triceps", 1), ...of("legs", 1)])).toEqual(["legs", "triceps"]);
    expect(primaryFocuses(["Not_A_Movement"])).toEqual([]);
  });

  it("names the muscle groups the athlete has been avoiding, and says nothing too early", () => {
    const chest = Object.keys(SESSION_POOL).filter((s) => SESSION_POOL[s].focus[0] === "chest").slice(0, 3);
    const on = (slug: string | null, logged_on: string) => ({ exercise_slug: slug, logged_on });
    const today = "2026-09-17";
    expect(neglectedFocuses([], today)).toEqual([]);
    // two training days: too early to say anything
    expect(neglectedFocuses([on(chest[0], "2026-09-16"), on(chest[1], "2026-09-15")], today)).toEqual([]);
    // a chest-only lifter is told about the big groups first
    const rows = ["2026-09-16", "2026-09-14", "2026-09-12", "2026-09-10"].flatMap((d) => chest.map((s) => on(s, d)));
    expect(neglectedFocuses(rows, today)).toEqual(["legs", "back", "glutes"]);
    // the same exercise twice on a day counts once; unknown slugs count the day, not a muscle
    expect(neglectedFocuses([...rows, ...rows, on("Not_A_Movement", "2026-09-16"), on(null, "2026-09-16")], today)).toEqual(["legs", "back", "glutes"]);
    // older than 28 days, or dated in the future, is ignored
    expect(neglectedFocuses(rows.map((r) => ({ ...r, logged_on: "2026-08-01" })), today)).toEqual([]);
    // training legs takes legs off the list
    const legs = Object.keys(SESSION_POOL).filter((s) => SESSION_POOL[s].focus[0] === "legs").slice(0, 3);
    const mixed = [...rows, ...["2026-09-15", "2026-09-11"].flatMap((d) => legs.map((s) => on(s, d)))];
    expect(neglectedFocuses(mixed, today)).not.toContain("legs");
  });

  it("is stable for a seed and different for another", () => {
    expect(build(["chest", "triceps"])).toEqual(build(["chest", "triceps"]));
    const a = build(["chest", "triceps"]).blocks.map((b) => b.slug).join("|");
    const b = build(["chest", "triceps"], { seed: "u" }).blocks.map((b) => b.slug).join("|");
    expect(a).not.toBe(b);
  });
});

// The engine carries the exercise catalog. One static import from app code
// and it rides in Home's bundle; `loadEngine()` is the only door.
describe("the engine stays out of the boot path", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === "__tests__" ? [] : walk(join(dir, e.name))) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [join(dir, e.name)] : []);

  it("no app file imports supabase/functions statically", () => {
    const offenders = walk("src").filter((f) => /^\s*(import|export)\s[^;]*from\s+["'][^"']*supabase\/functions/m.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
