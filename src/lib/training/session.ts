/**
 * Shared reads over a program's `plan_json` day.
 *
 * WHY THIS EXISTS
 *
 * "Is today a rest day?" was answered in four different places, and one of them
 * answered it differently:
 *
 *   TodaySessionCard.tsx     day.focus.toLowerCase() === "rest"
 *   ProgramWeekAccordion.tsx (day.focus ?? "").toLowerCase() === "rest"
 *   WeekStrip.tsx            d.focus.toLowerCase() === "rest"
 *   v2/ProgramCard.tsx       day.rest === true          ← the odd one out
 *
 * Nothing writes a `rest` boolean. The AI generator emits `focus: "Rest"` with
 * an empty `blocks` array, and so does the written beginner path
 * (`beginner-program.ts`). So the card on /coach was the only surface that
 * could never detect a rest day — it showed "Day 3 · Rest" followed by a line
 * assembled from a zero duration and zero blocks, on every rest day.
 *
 * Two of the three remaining copies also assume `focus` is a string. It is
 * typed as one, but plan_json is a `Json` column filled by a model, and older
 * plans used `session_name` instead — so a missing `focus` is a real shape,
 * and `.toLowerCase()` on it throws and blanks the screen.
 *
 * One function, defensive about the shape, used everywhere.
 */

/** The parts of a plan_json day these helpers rely on. Deliberately loose. */
export interface ProgramDayShape {
  focus?: string | null;
  /** Older generated plans used this instead of `focus`. */
  session_name?: string | null;
  duration_min?: number | null;
  blocks?: unknown;
}

/** What the day is called, falling back through the shapes plans have used. */
export const dayFocus = (day?: ProgramDayShape | null): string =>
  (day?.focus ?? day?.session_name ?? "").trim();

/**
 * A rest day. Decided by the focus label, because that is what every generator
 * actually writes — there is no `rest` boolean anywhere in the data.
 */
export const isRestDay = (day?: ProgramDayShape | null): boolean =>
  dayFocus(day).toLowerCase() === "rest";

/** How many working exercises the day prescribes. */
export const blockCount = (day?: ProgramDayShape | null): number =>
  Array.isArray(day?.blocks) ? day!.blocks.length : 0;

/**
 * True when the day has a session to actually do. A day can carry a focus and
 * still have no blocks (a truncated model response), and that is not something
 * to send someone to the gym for.
 */
export const isTrainingDay = (day?: ProgramDayShape | null): boolean =>
  !!day && !isRestDay(day) && blockCount(day) > 0;

/** Display label for a day, e.g. "Push · 45 min · 5 exercises". */
export const daySummary = (day?: ProgramDayShape | null): string => {
  if (!day) return "";
  if (isRestDay(day)) return "Rest day";
  const parts: string[] = [];
  if (day.duration_min) parts.push(`${day.duration_min} min`);
  const n = blockCount(day);
  if (n) parts.push(`${n} ${n === 1 ? "exercise" : "exercises"}`);
  return parts.join(" · ");
};
