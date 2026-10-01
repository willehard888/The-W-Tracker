import type { PlanJson, ProgramBlock, ProgramDay, ProgramWeek } from "@/hooks/use-coach-program";
import { isRestDay } from "@/lib/training/session";

/**
 * Hand edits to a program's plan_json: a training day to rest and back, one
 * movement for another, a movement added or taken out, a week repeated. Pure:
 * the plan that comes in is never touched. Every program is the same shape
 * (coach-built week, the beginner path, a member's own), so one editor serves
 * all of them.
 *
 * `scope` says how far an edit reaches: "week" is that week only; "remaining"
 * is that week and every later one, where the later weeks only change if the
 * edit still makes sense there (a planned session is never overwritten, a
 * movement is only swapped where it is present).
 */
export type At = { week: number; day: number; scope: "week" | "remaining" };

/** Duration under the session builder's own model: a warm-up, then every set and its rest. */
export const sessionMinutes = (blocks: { sets: number; rest_sec?: number | null }[]): number =>
  Math.round(10 + blocks.reduce((t, b) => t + (b.sets * (45 + (b.rest_sec ?? 75))) / 60, 0));

const MUSCLE = "(Chest|Back|Shoulders|Biceps|Triceps|Legs|Glutes|Core)";
const AUTO_LABEL = new RegExp(`^${MUSCLE}( & ${MUSCLE})*$`);
/** A day name the app wrote from the muscles trained (or no name at all); a coach's "Upper A" is left alone. */
export const isAutoLabel = (focus: string | null | undefined): boolean =>
  !focus || focus === "Rest" || focus === "Session" || AUTO_LABEL.test(focus);

const clone = <T,>(v: T): T => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v))) as T;
const restDay = (day: string): ProgramDay => ({ day, focus: "Rest", duration_min: 0, blocks: [], conditioning: "" });
/** A day with nothing left in it is a rest day; otherwise its length follows its blocks. */
const finish = (d: ProgramDay): ProgramDay =>
  d.blocks.length === 0 ? restDay(d.day) : { ...d, duration_min: sessionMinutes(d.blocks) };

/** Run `fn` on the addressed day of the addressed week, and of later weeks when the scope reaches them. */
const mapDays = (plan: PlanJson, at: At, fn: (day: ProgramDay, target: boolean) => ProgramDay): PlanJson => {
  const next = clone(plan);
  next.weeks = next.weeks.map((w: ProgramWeek) => {
    const target = w.week === at.week;
    if (!target && !(at.scope === "remaining" && w.week > at.week)) return w;
    const day = w.days[at.day];
    if (!day) return w;
    const days = [...w.days];
    days[at.day] = fn(day, target);
    return { ...w, days };
  });
  return next;
};

export const setRest = (plan: PlanJson, at: At): PlanJson => mapDays(plan, at, (d) => restDay(d.day));

/** A rest day becomes a session. Later weeks take it only where that day is still rest. */
export const setTraining = (plan: PlanJson, at: At, day: { focus: string; blocks: ProgramBlock[] }): PlanJson =>
  mapDays(plan, at, (d, target) =>
    target || isRestDay(d) ? finish({ ...d, focus: day.focus, blocks: clone(day.blocks), conditioning: d.conditioning ?? "" }) : d,
  );

/**
 * One movement for another. `keepRx` keeps the slot's own sets, reps and RPE
 * (a compound for a compound), so each week's progression survives; without it
 * the new movement brings its own prescription. Notes written for the old
 * movement go with it. Later weeks change only where the old movement is
 * still there and the new one is not.
 */
export const replaceBlock = (plan: PlanJson, at: At, slug: string, next: ProgramBlock, keepRx: boolean): PlanJson =>
  mapDays(plan, at, (d) => {
    const i = d.blocks.findIndex((b) => b.slug === slug);
    if (i < 0 || d.blocks.some((b) => b.slug === next.slug)) return d;
    const blocks = [...d.blocks];
    const old = blocks[i];
    blocks[i] = keepRx
      ? { slug: next.slug, name: next.name, sets: old.sets, reps: old.reps, rpe: old.rpe, rest_sec: old.rest_sec }
      : clone(next);
    return keepRx ? { ...d, blocks } : finish({ ...d, blocks });
  });

/** A movement on the end of the day. A rest day becomes a session; later weeks take it only where they already train that day. */
export const addBlock = (plan: PlanJson, at: At, block: ProgramBlock, label?: string): PlanJson =>
  mapDays(plan, at, (d, target) => {
    if (d.blocks.some((b) => b.slug === block.slug)) return d;
    if (!target && isRestDay(d)) return d;
    const focus = isAutoLabel(d.focus) ? label || "Session" : d.focus;
    return finish({ ...d, focus, blocks: [...d.blocks, clone(block)] });
  });

/** What a member may set by hand on a movement: the dose, nothing else. */
export type DosePatch = Partial<Pick<ProgramBlock, "sets" | "reps" | "rpe" | "rest_sec">>;

/** The runner's own bounds (buildSessionPlan clamps the same way), so a hand-set dose runs as written. */
export const clampDose = (patch: DosePatch): DosePatch => {
  const out: DosePatch = {};
  if (patch.sets != null) out.sets = Math.min(20, Math.max(1, Math.round(patch.sets)));
  if (patch.reps != null) {
    const reps = String(patch.reps).trim().replace(/\s*[–—]\s*/g, "-");
    if (/^\d+(-\d+)?$/.test(reps)) out.reps = reps;
  }
  if (patch.rpe !== undefined) out.rpe = patch.rpe == null ? null : Math.min(10, Math.max(5, Math.round(patch.rpe * 2) / 2));
  if (patch.rest_sec !== undefined) out.rest_sec = patch.rest_sec == null ? null : Math.min(900, Math.max(0, Math.round(patch.rest_sec)));
  return out;
};

/**
 * A movement's dose, set by hand — the numbers a self-built program lacked.
 * Later weeks take it only where the movement is still in that day.
 */
export const updateBlock = (plan: PlanJson, at: At, slug: string, patch: DosePatch): PlanJson => {
  const dose = clampDose(patch);
  if (Object.keys(dose).length === 0) return plan;
  return mapDays(plan, at, (d) => {
    if (!d.blocks.some((b) => b.slug === slug)) return d;
    const blocks = d.blocks.map((b) => (b.slug === slug ? { ...b, ...dose } : b));
    return { ...d, blocks, duration_min: sessionMinutes(blocks) };
  });
};

/** A movement out of the day; the last one out leaves a rest day. */
export const removeBlock = (plan: PlanJson, at: At, slug: string, label?: string): PlanJson =>
  mapDays(plan, at, (d) => {
    if (!d.blocks.some((b) => b.slug === slug)) return d;
    const blocks = d.blocks.filter((b) => b.slug !== slug);
    const focus = isAutoLabel(d.focus) ? label || "Session" : d.focus;
    return finish({ ...d, focus, blocks });
  });

/** One week laid out n times, numbered from 1: a repeating week the logs can still tell apart. */
export const repeatWeek = (week: ProgramWeek, n = 4): ProgramWeek[] =>
  Array.from({ length: n }, (_, i) => ({ ...clone(week), week: i + 1 }));

/**
 * The four-week wave a coach-built week runs through: base → build → peak →
 * light. The lifts and the rep ranges never change (the load climbs through
 * double progression, src/lib/training/overload.ts); the dose does — effort
 * rises half a point, the peak week adds a set, the light week takes one away
 * and a full point of effort, and the next block starts again, heavier. Each
 * week says what it is and why.
 */
export const WEEK_WAVE: ReadonlyArray<{ theme: string; sets: number; rpe: number; note: string }> = [
  { theme: "Base week", sets: 0, rpe: 0, note: "Find the weights: the top of every range at the effort written." },
  { theme: "Build week", sets: 0, rpe: 0.5, note: "Same lifts, half a point harder. Hit the top of a range on every set and the load goes up." },
  { theme: "Peak week", sets: 1, rpe: 0.5, note: "One more set on every lift — the heaviest week of the block." },
  { theme: "Light week", sets: -1, rpe: -1, note: "Fewer sets, easier effort. The body banks the block; the next one starts heavier." },
];

export const progressiveWeeks = (week: ProgramWeek, n = WEEK_WAVE.length): ProgramWeek[] =>
  Array.from({ length: n }, (_, i) => {
    const w = WEEK_WAVE[Math.min(i, WEEK_WAVE.length - 1)];
    const c = clone(week);
    for (const d of c.days) {
      d.blocks = (d.blocks ?? []).map((b) => ({
        ...b,
        ...clampDose({
          sets: Math.max(1, (Number(b.sets) || 1) + w.sets),
          rpe: b.rpe == null ? undefined : b.rpe + w.rpe,
        }),
      }));
    }
    return { ...c, week: i + 1, theme: w.theme, progression_note: w.note };
  });

/**
 * True when every week from `fromWeek` on is the same seven days: a week that
 * simply repeats. Nobody planned ahead, so the page shows one week and no
 * week switcher; a block that progresses, or a member's one-week change,
 * makes the weeks differ and brings the switcher back.
 */
export const isRepeatingWeek = (plan: PlanJson, fromWeek = 1): boolean => {
  const weeks = plan.weeks ?? [];
  // The last week of a block is judged against the one before it: alone it
  // is trivially "the same", and the switcher vanished on week 4 of a wave.
  const lastWeek = Math.max(...weeks.map((w) => w.week), 1);
  const from = Math.min(fromWeek, lastWeek - 1);
  const ahead = weeks.filter((w) => w.week >= from).map((w) => JSON.stringify(w.days));
  // No week from here on is not "a week that repeats": it would hide the only way off a stale week.
  return ahead.length > 0 && ahead.every((d) => d === ahead[0]);
};
