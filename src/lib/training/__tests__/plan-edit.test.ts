import { describe, expect, it } from "vitest";
import type { PlanJson, ProgramBlock, ProgramDay } from "@/hooks/use-coach-program";
import { addBlock, isAutoLabel, removeBlock, repeatWeek, replaceBlock, sessionMinutes, setRest, setTraining } from "../plan-edit";
import { sessionMinutes as engineMinutes } from "../../../../supabase/functions/_shared/session-builder";

const block = (slug: string, sets = 3): ProgramBlock => ({ slug, name: slug.replace(/_/g, " "), sets, reps: "8-12", rpe: 8, rest_sec: 60 });
const rest = (day: string): ProgramDay => ({ day, focus: "Rest", duration_min: 0, blocks: [], conditioning: "" });
const train = (day: string, focus: string, slugs: string[]): ProgramDay => ({ day, focus, duration_min: 40, blocks: slugs.map((s) => block(s)), conditioning: "" });
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const week = (n: number) => ({
  week: n,
  theme: `Week ${n}`,
  days: DAYS.map((d, i) => (i === 0 ? train(d, "Upper A", ["Bench", "Row"]) : i === 3 ? train(d, "Back & Biceps", ["Pulldown", "Curl"]) : rest(d))),
  nutrition: { protein_g_per_kg: 1.6, daily_kcal_band: "Maintenance", notes: "" },
  recovery: { sleep_target_h: 7.5, mobility_min: 10, breathwork: "" },
});
// stored out of order on purpose: weeks are addressed by number, never by position
const plan = (): PlanJson => ({ weeks: [week(2), week(1), week(3)], weekly_check_targets: { workouts: 2, sleep_avg_h: 7.5, hydration_l: 2.5, perfect_days: 2 } });
const dayOf = (p: PlanJson, w: number, d: number) => p.weeks.find((x) => x.week === w)!.days[d];

describe("plan-edit", () => {
  it("never touches the plan it was given", () => {
    const p = plan();
    const before = JSON.stringify(p);
    setRest(p, { week: 1, day: 0, scope: "remaining" });
    addBlock(p, { week: 1, day: 1, scope: "week" }, block("Squat"), "Legs");
    replaceBlock(p, { week: 1, day: 0, scope: "remaining" }, "Bench", block("Dumbbell_Press"), true);
    expect(JSON.stringify(p)).toBe(before);
  });

  it("a training day to rest: this week only, or this week and every later one", () => {
    const one = setRest(plan(), { week: 2, day: 0, scope: "week" });
    expect(dayOf(one, 2, 0)).toEqual(rest("Mon"));
    expect(dayOf(one, 1, 0).blocks).toHaveLength(2);
    expect(dayOf(one, 3, 0).blocks).toHaveLength(2);
    const on = setRest(plan(), { week: 2, day: 0, scope: "remaining" });
    expect(dayOf(on, 1, 0).blocks).toHaveLength(2); // the past is left alone
    expect(dayOf(on, 2, 0)).toEqual(rest("Mon"));
    expect(dayOf(on, 3, 0)).toEqual(rest("Mon"));
  });

  it("a rest day to training, and later weeks only where that day is still rest", () => {
    const base = setTraining(plan(), { week: 3, day: 1, scope: "week" }, { focus: "Legs", blocks: [block("Leg_Press")] });
    const p = setTraining(base, { week: 1, day: 1, scope: "remaining" }, { focus: "Glutes", blocks: [block("Hip_Thrust", 4)] });
    expect(dayOf(p, 1, 1)).toMatchObject({ day: "Tue", focus: "Glutes" });
    expect(dayOf(p, 1, 1).duration_min).toBe(sessionMinutes([block("Hip_Thrust", 4)]));
    expect(dayOf(p, 2, 1).focus).toBe("Glutes");
    expect(dayOf(p, 3, 1).focus).toBe("Legs"); // a planned session is never overwritten
  });

  it("one movement for another keeps each week's own prescription when asked, and drops the old notes", () => {
    const p0 = plan();
    dayOf(p0, 2, 0).blocks[0] = { ...block("Bench", 5), notes: "pause on the chest", alt: "Push-up" };
    const p = replaceBlock(p0, { week: 1, day: 0, scope: "remaining" }, "Bench", { ...block("Dumbbell_Press", 3), rpe: 7 }, true);
    expect(dayOf(p, 1, 0).blocks[0]).toEqual({ slug: "Dumbbell_Press", name: "Dumbbell Press", sets: 3, reps: "8-12", rpe: 8, rest_sec: 60 });
    expect(dayOf(p, 2, 0).blocks[0]).toEqual({ slug: "Dumbbell_Press", name: "Dumbbell Press", sets: 5, reps: "8-12", rpe: 8, rest_sec: 60 });
    expect(dayOf(p, 1, 0).duration_min).toBe(40); // same slot, same length
    // without keepRx the new movement brings its own dose and the day's length follows
    const own = replaceBlock(plan(), { week: 1, day: 0, scope: "week" }, "Bench", block("Cable_Fly", 2), false);
    expect(dayOf(own, 1, 0).blocks[0].sets).toBe(2);
    expect(dayOf(own, 1, 0).duration_min).toBe(sessionMinutes(dayOf(own, 1, 0).blocks));
    // nothing happens when the old movement is absent or the new one is already there
    expect(replaceBlock(plan(), { week: 1, day: 0, scope: "week" }, "Nope", block("X"), true)).toEqual(plan());
    expect(replaceBlock(plan(), { week: 1, day: 0, scope: "week" }, "Bench", block("Row"), true)).toEqual(plan());
  });

  it("adds and removes movements; the last one out leaves a rest day", () => {
    const at = { week: 1, day: 3, scope: "week" } as const;
    const added = addBlock(plan(), at, block("Face_Pull"), "Back & Shoulders");
    expect(dayOf(added, 1, 3).blocks.map((b) => b.slug)).toEqual(["Pulldown", "Curl", "Face_Pull"]);
    expect(dayOf(added, 1, 3).focus).toBe("Back & Shoulders"); // an auto label follows the muscles
    expect(addBlock(added, at, block("Face_Pull"))).toEqual(added); // no duplicates
    const named = addBlock(plan(), { week: 1, day: 0, scope: "week" }, block("Fly"), "Chest");
    expect(dayOf(named, 1, 0).focus).toBe("Upper A"); // the coach's name stays
    // onto a rest day: a session starts; later weeks do not grow a new training day
    const fresh = addBlock(plan(), { week: 1, day: 5, scope: "remaining" }, block("Squat"), "Legs");
    expect(dayOf(fresh, 1, 5)).toMatchObject({ focus: "Legs", duration_min: sessionMinutes([block("Squat")]) });
    expect(dayOf(fresh, 2, 5)).toEqual(rest("Sat"));
    const gone = removeBlock(removeBlock(plan(), at, "Pulldown", "Biceps"), at, "Curl");
    expect(dayOf(gone, 1, 3)).toEqual(rest("Thu"));
    expect(dayOf(removeBlock(plan(), at, "Pulldown", "Biceps"), 1, 3).focus).toBe("Biceps");
  });

  it("repeats a week as numbered copies", () => {
    const weeks = repeatWeek(week(7));
    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4]);
    expect(weeks[2].days).toEqual(week(7).days);
    expect(weeks[0].days).not.toBe(weeks[1].days);
  });

  it("knows a label the app wrote from one a coach wrote, and times a session like the builder", () => {
    for (const s of ["Rest", "Session", "", null, "Legs", "Back & Biceps", "Chest & Shoulders & Triceps"]) expect(isAutoLabel(s), String(s)).toBe(true);
    for (const s of ["Upper A", "Full body", "Push", "Lower"]) expect(isAutoLabel(s), s).toBe(false);
    const blocks = [{ sets: 4, rest_sec: 120 }, { sets: 3, rest_sec: 60 }];
    expect(sessionMinutes(blocks)).toBe(engineMinutes(blocks));
  });
});
