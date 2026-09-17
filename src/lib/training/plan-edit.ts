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

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
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
