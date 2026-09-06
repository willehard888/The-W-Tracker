import { supabase } from "@/integrations/supabase/client";
import {
  PATH_MOVEMENTS,
  BLOCK_1_SESSIONS,
  BLOCK_2_SESSIONS,
  BLOCK_1_WEEKS,
  BLOCK_2_WEEKS,
  type PathSession,
  type PathWeek,
} from "@/data/beginner-path";

/**
 * Turns the written beginner path into a program row.
 *
 * The whole trick here is that it emits the SAME `plan_json` shape the AI
 * generator emits. Because of that, the beginner path renders in
 * `ProgramWeekAccordion`, `TodaySessionCard`, `CoachProgramDetail` and
 * `ExerciseRow` with no UI work at all, set logging works from day one, and
 * the progression chart draws itself. Nothing downstream needs to know
 * whether a program was written or generated.
 *
 * It also skips the model call entirely, so a beginner's first program appears
 * instantly instead of after a round trip that can take half a minute.
 */

/** 0 = Mon … 6 = Sun — the order `useCoachProgram` indexes days by. */
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Mon / Wed / Fri, so there is always a day off between sessions. */
const TRAIN_DAY_INDEXES = [0, 2, 4] as const;

export type BeginnerBlock = 1 | 2;

/**
 * Declared as type aliases rather than interfaces on purpose: `plan_json` is a
 * `Json` column, and only type aliases get the implicit index signature that
 * assignment to `Json` requires. As interfaces these fail the strict gate.
 */
type PlanBlock = {
  slug: string;
  name: string;
  sets: number;
  reps: string;
  rpe: number;
  rest_sec: number;
};

type PlanDay = {
  day: string;
  focus: string;
  duration_min: number;
  blocks: PlanBlock[];
  conditioning: string;
};

const buildDay = (day: string, session: PathSession | null, week: PathWeek): PlanDay => {
  if (!session) {
    return { day, focus: "Rest", duration_min: 0, blocks: [], conditioning: "" };
  }

  const blocks = session.movements.map((key) => {
    const m = PATH_MOVEMENTS[key];
    return {
      // The catalog slug fetches the photo, the instructions and the logging
      // identity; `resolveExercise` checks the slug before the name.
      slug: m.catalogSlug,
      // The ILLUSTRATED title, deliberately — this is what `ExerciseRow`
      // matches on to draw the picture and the rep animation.
      name: m.name,
      sets: week.sets,
      reps: week.reps,
      rpe: week.rpe,
      rest_sec: week.rest_sec,
    };
  });

  // Roughly: a warm-up plus each set and its rest. Close enough to plan an
  // evening around, which is all this number is for.
  const duration_min = 10 + Math.round(
    (blocks.length * week.sets * (45 + week.rest_sec)) / 60,
  );

  return { day, focus: session.focus, duration_min, blocks, conditioning: "" };
};

const buildWeek = (week: PathWeek, sessions: PathSession[]) => ({
  week: week.week,
  theme: week.theme,
  progression_note: week.progression_note,
  days: WEEK_DAYS.map((day, i) => {
    const trainIdx = TRAIN_DAY_INDEXES.indexOf(i as (typeof TRAIN_DAY_INDEXES)[number]);
    return buildDay(day, trainIdx >= 0 ? sessions[trainIdx] : null, week);
  }),
  nutrition: {
    protein_g_per_kg: 1.6,
    daily_kcal_band: "Maintenance",
    notes:
      "Eat about the same as you do now while you learn to train. Aim for a palm of protein at each meal — that is the one thing worth changing first.",
  },
  recovery: {
    sleep_target_h: 7.5,
    mobility_min: 10,
    breathwork: "Five slow breaths before your first set — it steadies you more than it sounds like it should.",
  },
});

/** The whole 4-week block, in the shape the AI generator emits. */
export const buildBeginnerPlan = (block: BeginnerBlock) => {
  const weeks = block === 1 ? BLOCK_1_WEEKS : BLOCK_2_WEEKS;
  const sessions = block === 1 ? BLOCK_1_SESSIONS : BLOCK_2_SESSIONS;

  return {
    weekly_check_targets: {
      workouts: 3,
      sleep_avg_h: 7.5,
      hydration_l: 2.5,
      // Three of seven days perfect is a target a beginner can actually hit.
      // A number nobody reaches stops meaning anything by week two.
      perfect_days: 3,
    },
    weeks: weeks.map((w) => buildWeek(w, sessions)),
  };
};

const SUMMARY: Record<BeginnerBlock, string> = {
  1: "This is your first block, and it is deliberately simple: three full-body sessions a week, four movements each, the same ones every week. You are not here to be sore — you are here to learn thirteen movements well enough that they stop being frightening. Start lighter than feels worth it. That part matters more than anything else you do in the next four weeks.",
  2: "Second block. Same three sessions, one more movement in each, and the weights start moving properly now. You already know what these lifts feel like, so this is where the work starts showing up in the numbers you log.",
};

/** The `experience` value each written block stamps on its program row. */
export const BLOCK_EXPERIENCE: Record<BeginnerBlock, string> = {
  1: "beginner_block_1",
  2: "beginner_block_2",
};

/**
 * Which block a beginner gets next, from what they last ran.
 *
 * Returns `null` once both written blocks are behind them — that is the
 * graduation point, where the AI generator takes over. By then it has eight
 * weeks of the athlete's own logged sets to progress from, which is the
 * situation it was actually designed for.
 */
export const nextBeginnerBlock = (lastExperience?: string | null): BeginnerBlock | null => {
  if (lastExperience === BLOCK_EXPERIENCE[2]) return null;
  if (lastExperience === BLOCK_EXPERIENCE[1]) return 2;
  return 1;
};

/**
 * Writes the block as the athlete's active program, superseding whatever came
 * before — the same transition the AI generator performs, so the two paths are
 * interchangeable and an athlete can move from one to the other at any point.
 */
export const createBeginnerProgram = async (opts: {
  userId: string;
  block: BeginnerBlock;
  goal?: string | null;
  equipment?: string[] | null;
}) => {
  const { userId, block } = opts;

  await supabase
    .from("coach_programs")
    .update({ status: "superseded" })
    .eq("user_id", userId)
    .eq("status", "active");

  const { data, error } = await supabase
    .from("coach_programs")
    .insert({
      user_id: userId,
      goal: opts.goal ?? "all",
      // The column has existed since the first migration and every row until
      // now said "auto", because nothing ever asked. These rows say what they
      // actually are.
      experience: BLOCK_EXPERIENCE[block],
      days_per_week: TRAIN_DAY_INDEXES.length,
      equipment: (opts.equipment ?? []).join(", ") || "Full gym",
      body_focus: [],
      constraints: null,
      weeks: 4,
      plan_json: buildBeginnerPlan(block),
      ai_summary: SUMMARY[block],
      generated_with: "written_beginner_path_v1",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};
