import { describe, it, expect } from "vitest";
import { buildBeginnerPlan, type BeginnerBlock } from "@/lib/beginner-program";
import { PATH_MOVEMENTS } from "@/data/beginner-path";
import { findIllustrated } from "@/data/exercises-illustrated";
import { coachingFor } from "@/data/exercise-coaching";

/**
 * The written path only renders for free because it emits exactly the shape
 * the AI generator emits. If that shape drifts, nothing throws — the program
 * screen just quietly shows an empty week, which is the worst possible way to
 * find out. So the shape is asserted rather than assumed.
 *
 * `useCoachProgram` indexes `week.days[i]` with 0 = Mon … 6 = Sun. Getting that
 * order wrong would put Monday's session on Sunday, and it would look fine in
 * every screenshot.
 */

const blocks: BeginnerBlock[] = [1, 2];
const byName = new Map(Object.values(PATH_MOVEMENTS).map((m) => [m.name, m]));

describe.each(blocks)("beginner plan — block %i", (block) => {
  const plan = buildBeginnerPlan(block);

  it("emits four weeks numbered 1 to 4", () => {
    expect(plan.weeks).toHaveLength(4);
    expect(plan.weeks.map((w) => w.week)).toEqual([1, 2, 3, 4]);
  });

  it("emits seven days per week, Monday first", () => {
    for (const w of plan.weeks) {
      expect(w.days).toHaveLength(7);
      expect(w.days.map((d) => d.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    }
  });

  it("trains Monday, Wednesday and Friday and rests the other four days", () => {
    for (const w of plan.weeks) {
      const training = w.days.map((d, i) => (d.blocks.length > 0 ? i : -1)).filter((i) => i >= 0);
      expect(training).toEqual([0, 2, 4]);
      for (const rest of [1, 3, 5, 6]) {
        expect(w.days[rest].blocks).toHaveLength(0);
        expect(w.days[rest].focus).toBe("Rest");
      }
    }
  });

  it("gives every prescribed block a picture and real coaching", () => {
    for (const w of plan.weeks) {
      for (const d of w.days) {
        for (const b of d.blocks) {
          const m = byName.get(b.name);
          expect(m, `"${b.name}" is not a path movement`).toBeTruthy();
          // The slug and name come from different vocabularies on purpose;
          // swapping them would break the photo or the illustration silently.
          expect(b.slug).toBe(m!.catalogSlug);
          expect(findIllustrated(b.name)?.slug).toBe(m!.illustratedSlug);
          expect(coachingFor(m!.illustratedSlug), `no coaching for "${b.name}"`).toBeTruthy();
        }
      }
    }
  });

  it("prescribes sets, reps and rest on every block", () => {
    for (const w of plan.weeks) {
      for (const d of w.days) {
        for (const b of d.blocks) {
          expect(b.sets).toBeGreaterThan(0);
          expect(b.reps.trim().length).toBeGreaterThan(0);
          expect(b.rpe).toBeGreaterThanOrEqual(1);
          expect(b.rpe).toBeLessThanOrEqual(10);
          expect(b.rest_sec).toBeGreaterThan(0);
        }
      }
    }
  });

  it("gives each week a progression note and each session a duration", () => {
    for (const w of plan.weeks) {
      expect(w.progression_note.trim().length).toBeGreaterThan(0);
      expect(w.theme.trim().length).toBeGreaterThan(0);
      for (const d of w.days) {
        if (d.blocks.length === 0) continue;
        expect(d.duration_min).toBeGreaterThan(0);
        // A beginner session that reads as two hours is one nobody starts.
        expect(d.duration_min).toBeLessThanOrEqual(75);
      }
    }
  });

  it("sets weekly targets the athlete can actually hit", () => {
    expect(plan.weekly_check_targets.workouts).toBe(3);
    expect(plan.weekly_check_targets.perfect_days).toBeLessThanOrEqual(7);
  });
});

describe("beginner plan — block differences", () => {
  it("adds a movement per session in block 2", () => {
    const one = buildBeginnerPlan(1).weeks[0].days[0].blocks.length;
    const two = buildBeginnerPlan(2).weeks[0].days[0].blocks.length;
    expect(two).toBe(one + 1);
  });

  it("starts block 1 lighter than it finishes", () => {
    const w = buildBeginnerPlan(1).weeks;
    expect(w[0].days[0].blocks[0].rpe).toBeLessThan(w[3].days[0].blocks[0].rpe);
    expect(w[0].days[0].blocks[0].sets).toBeLessThan(w[3].days[0].blocks[0].sets);
  });
});
