import { describe, it, expect } from "vitest";
import {
  PATH_MOVEMENTS,
  BLOCK_1_SESSIONS,
  BLOCK_2_SESSIONS,
  BLOCK_1_WEEKS,
  BLOCK_2_WEEKS,
  type PathMovementKey,
} from "@/data/beginner-path";
import { findIllustrated } from "@/data/exercises-illustrated";
import { coachingFor } from "@/data/exercise-coaching";
import { EXERCISE_CATALOG } from "../../../supabase/functions/_shared/exercise-catalog";

/**
 * The three-vocabulary test — the most important one in the beginner path.
 *
 * A prescribed movement has to land in three different datasets at once: the
 * catalog (photo, instructions, logging identity), the illustrations (the
 * picture and the rep animation) and the coaching (the actual teaching). Their
 * names do not agree with each other, and every previous attempt to join them
 * by guessing a name has failed — most visibly when 229 exercises rendered an
 * illustration with no instructions underneath it, mid-workout.
 *
 * If any assertion here fails, a beginner is being sent to a movement they
 * cannot see or cannot learn. That is the whole reason the path is written
 * down rather than generated.
 */

const catalogSlugs = new Set(EXERCISE_CATALOG.map((e) => e.slug));
const movements = Object.entries(PATH_MOVEMENTS) as [PathMovementKey, (typeof PATH_MOVEMENTS)[PathMovementKey]][];

describe("beginner path — the three-vocabulary join", () => {
  it("prescribes only movements the coach's catalog actually contains", () => {
    for (const [key, m] of movements) {
      expect(catalogSlugs.has(m.catalogSlug), `${key}: no catalog entry "${m.catalogSlug}"`).toBe(true);
    }
  });

  it("draws an illustration for every movement", () => {
    for (const [key, m] of movements) {
      const hit = findIllustrated(m.name);
      expect(hit, `${key}: "${m.name}" matches no illustration`).toBeTruthy();
      // Not just any illustration — the specific one the coaching is keyed to.
      expect(hit!.slug, `${key}: "${m.name}" drew the wrong illustration`).toBe(m.illustratedSlug);
    }
  });

  it("teaches every movement it prescribes", () => {
    for (const [key, m] of movements) {
      expect(
        coachingFor(m.illustratedSlug),
        `${key}: no coaching written for "${m.illustratedSlug}" — a beginner would meet this movement with only "return to starting position"`,
      ).toBeTruthy();
    }
  });
});

describe("beginner path — shape", () => {
  const allSessions = [...BLOCK_1_SESSIONS, ...BLOCK_2_SESSIONS];

  it("references only movements that exist in the spine", () => {
    for (const s of allSessions) {
      for (const key of s.movements) {
        expect(PATH_MOVEMENTS[key], `${s.focus}: unknown movement "${key}"`).toBeTruthy();
      }
    }
  });

  it("runs three sessions a week in both blocks", () => {
    expect(BLOCK_1_SESSIONS).toHaveLength(3);
    expect(BLOCK_2_SESSIONS).toHaveLength(3);
  });

  it("keeps block 1 short and block 2 one movement longer", () => {
    // Week one in a gym is not the place for a ninety-minute session.
    for (const s of BLOCK_1_SESSIONS) expect(s.movements).toHaveLength(4);
    for (const s of BLOCK_2_SESSIONS) expect(s.movements).toHaveLength(5);
  });

  it("never repeats a movement inside one session", () => {
    for (const s of allSessions) {
      expect(new Set(s.movements).size, `${s.focus} lists a movement twice`).toBe(s.movements.length);
    }
  });

  it("covers four weeks per block, numbered 1 to 4", () => {
    for (const weeks of [BLOCK_1_WEEKS, BLOCK_2_WEEKS]) {
      expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4]);
      for (const w of weeks) {
        expect(w.sets).toBeGreaterThan(0);
        expect(w.reps.trim().length, `week ${w.week} has no rep target`).toBeGreaterThan(0);
        expect(w.rpe).toBeGreaterThanOrEqual(1);
        expect(w.rpe).toBeLessThanOrEqual(10);
        expect(
          w.progression_note.trim().length,
          `week ${w.week} has no progression note — the note IS the progression rule`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("starts deliberately easy", () => {
    // The single most important number in the whole path: week one has to be
    // light enough that a beginner finishes it and comes back.
    expect(BLOCK_1_WEEKS[0].rpe).toBeLessThanOrEqual(5);
    expect(BLOCK_1_WEEKS[0].sets).toBeLessThanOrEqual(2);
  });
});
