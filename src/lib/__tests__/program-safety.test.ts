import { describe, expect, it } from "vitest";
import { isRestDay } from "@/lib/training/session";
import { EXERCISE_CATALOG, filterCatalog } from "../../../supabase/functions/_shared/exercise-catalog";
import { PRIORITY_SLUGS } from "../../../supabase/functions/_shared/illustrated-catalog";
import {
  bannedSlugs,
  stripUnallowedBlocks,
  thinDays,
  type InjuryTag,
} from "../../../supabase/functions/_shared/program-safety";
import { normalizeInjuries, validateProgram } from "../../../supabase/functions/coach-generate-program/movements";

/**
 * The generator's safety layer, tested against the real 542-item catalog: what
 * an injured or newer athlete must never be offered, what the model is shown
 * inside the 200 cap, and what happens to a plan that ignores the catalog.
 */

const tags = (...t: InjuryTag[]) => new Set<InjuryTag>(t);
const slugs = new Set(EXERCISE_CATALOG.map((e) => e.slug));

describe("bannedSlugs", () => {
  it("knee bans lunges, leg extensions and step-ups, keeps the leg press", () => {
    const b = bannedSlugs(EXERCISE_CATALOG, tags("knee"), "experienced");
    for (const s of ["Dumbbell_Lunges", "Leg_Extensions", "Barbell_Step_Ups"]) expect(b.has(s), s).toBe(true);
    expect(b.has("Leg_Press")).toBe(false);
  });

  it("lower back bans deadlifts and good mornings, keeps the machine bench", () => {
    const b = bannedSlugs(EXERCISE_CATALOG, tags("lower_back"), "experienced");
    expect(b.has("Barbell_Deadlift")).toBe(true);
    expect(b.has("Good_Morning")).toBe(true);
    // Primary-muscle rule, not just the name.
    expect(b.has("Hyperextensions_(Back_Extensions)") || [...b].some((s) => /Hyperextension/.test(s))).toBe(true);
    expect(b.has("Machine_Bench_Press")).toBe(false);
  });

  it("shoulder bans the shoulder press; elbow bans curls but not leg curls", () => {
    expect(bannedSlugs(EXERCISE_CATALOG, tags("shoulder"), "experienced").has("Barbell_Shoulder_Press")).toBe(true);
    const elbow = bannedSlugs(EXERCISE_CATALOG, tags("elbow"), "experienced");
    expect(elbow.has("Barbell_Curl")).toBe(true);
    expect(elbow.has("Seated_Leg_Curl")).toBe(false);
    expect(elbow.has("Leg_Extensions")).toBe(false);
  });

  it("experience: under six months loses olympic/powerlifting and advanced lifts; experienced keeps them", () => {
    const newer = bannedSlugs(EXERCISE_CATALOG, tags(), "under_6_months");
    for (const s of ["Clean", "Board_Press", "Jefferson_Squats"]) expect(newer.has(s), s).toBe(true);
    // "lever" must not catch the Leverage machines.
    expect(newer.has("Leverage_Decline_Chest_Press")).toBe(false);
    expect(bannedSlugs(EXERCISE_CATALOG, tags(), "never_trained")).toEqual(newer);
    expect(bannedSlugs(EXERCISE_CATALOG, tags(), "experienced").has("Clean")).toBe(false);
    // Unknown (pre-question profile) and garbage both fall back to olympic-only.
    const unknown = bannedSlugs(EXERCISE_CATALOG, tags(), null);
    expect(unknown.has("Clean")).toBe(true);
    expect(unknown.has("Board_Press")).toBe(false);
    expect(bannedSlugs(EXERCISE_CATALOG, tags(), "wat")).toEqual(unknown);
  });

  it("combines injuries", () => {
    const b = bannedSlugs(EXERCISE_CATALOG, normalizeInjuries(["Knee", "Lower back"]), "experienced");
    expect(b.has("Dumbbell_Lunges")).toBe(true);
    expect(b.has("Barbell_Deadlift")).toBe(true);
  });

  it("every priority slug survives with no injuries and an experienced athlete", () => {
    const b = bannedSlugs(EXERCISE_CATALOG, tags(), "experienced");
    expect(PRIORITY_SLUGS.filter((s) => b.has(s))).toEqual([]);
    expect(PRIORITY_SLUGS.filter((s) => !slugs.has(s))).toEqual([]);
  });
});

describe("filterCatalog with priority + exclude", () => {
  const full = ["full_gym"];

  it("puts the illustrated staples inside the 200 for a full gym and keeps the cap", () => {
    const items = filterCatalog(full, 200, { priority: PRIORITY_SLUGS });
    const got = new Set(items.map((e) => e.slug));
    for (const s of ["Leg_Press", "Romanian_Deadlift", "Pullups", "Seated_Cable_Rows"]) expect(got.has(s), s).toBe(true);
    expect(items.length).toBeLessThanOrEqual(200);
    expect(items.length).toBe(filterCatalog(full, 200).length);
  });

  it("the onboarding presets map to real equipment (they used to yield an empty catalog)", () => {
    expect(filterCatalog(["full_gym"]).length).toBeGreaterThan(100);
    expect(filterCatalog(["home_minimal"]).some((e) => e.equipment === "dumbbell")).toBe(true);
    expect(filterCatalog(["outdoor"]).every((e) => e.equipment === "bodyweight")).toBe(true);
  });

  it("excludes banned slugs and is unchanged without options", () => {
    const banned = bannedSlugs(EXERCISE_CATALOG, tags("knee"), "under_6_months");
    const items = filterCatalog(full, 200, { exclude: banned, priority: PRIORITY_SLUGS });
    expect(items.some((e) => banned.has(e.slug))).toBe(false);
    expect(items.some((e) => e.slug === "Leg_Press")).toBe(true);
    expect(filterCatalog(["barbell"], 200, {})).toEqual(filterCatalog(["barbell"]));
    // Bodyweight-only path honours exclude too.
    expect(filterCatalog(["bodyweight"], 50, { exclude: new Set(["Pushups"]) }).some((e) => e.slug === "Pushups")).toBe(false);
  });
});

const day = (d: string, focus: string, ...blockSlugs: string[]) => ({
  day: d,
  focus,
  duration_min: focus === "Rest" ? 0 : 45,
  blocks: blockSlugs.map((slug) => ({ slug, name: slug.replace(/_/g, " "), sets: 3, reps: "8", rpe: 7 })),
});

const plan = {
  weekly_check_targets: { workouts: 2 },
  weeks: [
    {
      week: 1,
      theme: "t",
      days: [
        day("Mon", "Lower", "Leg_Press", "Dumbbell_Lunges", "Romanian_Deadlift", "Seated_Leg_Curl"),
        day("Tue", "Rest"),
        day("Wed", "Upper", "Pullups", "Made_Up_Row", "Machine_Bench_Press"),
      ],
    },
  ],
};

describe("stripUnallowedBlocks", () => {
  it("removes blocks outside the allowed set, reports them and keeps everything else", () => {
    const allowed = new Set(["Leg_Press", "Romanian_Deadlift", "Seated_Leg_Curl", "Pullups", "Machine_Bench_Press"]);
    const { plan: out, removed } = stripUnallowedBlocks(plan, allowed);
    expect(removed).toEqual(["W1 Mon: Dumbbell Lunges", "W1 Wed: Made Up Row"]);
    expect(out.weeks[0].days[0].blocks.map((b) => b.slug)).toEqual(["Leg_Press", "Romanian_Deadlift", "Seated_Leg_Curl"]);
    expect(out.weeks[0].days[2].blocks.map((b) => b.slug)).toEqual(["Pullups", "Machine_Bench_Press"]);
    expect(out.weekly_check_targets).toEqual(plan.weekly_check_targets);
    expect(out.weeks[0].theme).toBe("t");
    // Input untouched.
    expect(plan.weeks[0].days[0].blocks).toHaveLength(4);
  });

  it("tolerates model output with no weeks, no days, no blocks or no slug", () => {
    expect(stripUnallowedBlocks({}, new Set())).toEqual({ plan: {}, removed: [] });
    const odd = { weeks: [{ days: [{ blocks: [{ name: "no slug" }] }, {}] }, {}] };
    const { plan: out, removed } = stripUnallowedBlocks(odd, new Set());
    expect(removed).toEqual(["W? ?: no slug"]);
    expect(out.weeks[0].days?.[0]?.blocks).toEqual([]);
  });
});

describe("thinDays", () => {
  it("flags a training day under three blocks and ignores rest days", () => {
    const allowed = new Set(["Leg_Press", "Romanian_Deadlift", "Seated_Leg_Curl", "Pullups", "Machine_Bench_Press"]);
    const { plan: out } = stripUnallowedBlocks(plan, allowed);
    expect(thinDays(out)).toEqual(["W1 Wed (2 blocks)"]);
    expect(thinDays(plan)).toEqual([]);
    expect(thinDays(out, 4)).toEqual(["W1 Mon (3 blocks)", "W1 Wed (2 blocks)"]);
    // Same notion of "rest" as the client's session helpers.
    const rest = out.weeks[0].days.filter((d) => isRestDay(d));
    expect(rest.map((d) => d.day)).toEqual(["Tue"]);
    expect(thinDays({ weeks: [{ week: 2, days: [day("Sat", "rest")] }] })).toEqual([]);
  });

  it("flags a training day the strip emptied, and tolerates missing shapes", () => {
    expect(thinDays({ weeks: [{ week: 1, days: [{ day: "Mon", focus: "Push", blocks: [] }] }] })).toEqual(["W1 Mon (0 blocks)"]);
    expect(thinDays({})).toEqual([]);
    expect(thinDays({ weeks: [{}] })).toEqual([]);
  });
});

describe("validateProgram names contraindicated slugs", () => {
  it("says contraindicated for a banned slug and catalog for an invented one", () => {
    const week = (n: number) => ({
      week: n,
      days: [day("Mon", "Lower", "Leg_Press", "Dumbbell_Lunges", "Made_Up_Row"), ...["Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => day(d, "Rest"))],
    });
    const v = validateProgram(
      { weeks: [1, 2, 3, 4].map(week) },
      { trainDayNames: ["Mon"], sessionMinCap: 60, allowedSlugs: new Set(["Leg_Press"]), bannedSlugs: new Set(["Dumbbell_Lunges"]) },
    );
    expect(v.some((s) => s.includes('"Dumbbell Lunges" is contraindicated'))).toBe(true);
    expect(v.some((s) => s.includes('"Made Up Row" is not in the allowed exercise catalog'))).toBe(true);
    expect(v.some((s) => s.includes("must contain 7 days"))).toBe(false);
  });
});
