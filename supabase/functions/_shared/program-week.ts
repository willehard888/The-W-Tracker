/**
 * MIRROR of src/lib/training/program-week.ts — keep byte-identical below this
 * header; src/lib/training/__tests__/program-week-parity.test.ts asserts both
 * copies agree. The edge functions (coach-daily-plan, ai-coach,
 * coach-daily-brief) used a calendar-only week while the client waited for
 * missed weeks, so the runner, the daily plan and the brief disagreed about
 * which week the athlete was in.
 *
 * Where the athlete actually is in a block, and whether the block is over.
 *
 * WHY THIS EXISTS
 *
 * `currentWeek` was a pure calendar read:
 *
 *   Math.min(program.weeks, Math.max(1, Math.floor(daysSinceStart / 7) + 1))
 *
 * Two consequences, both bad, both silent.
 *
 * **The program slid past people.** Miss a week to illness or travel and the
 * plan advanced anyway. You came back to week 3 having trained week 1 — the
 * loads assume work you never did, and the app never acknowledged the gap. The
 * clamp made it worse at the end: after the final week it pinned there forever,
 * so a finished block looked identical to an abandoned one and the athlete sat
 * on "Week 4" indefinitely with nothing offering what came next.
 *
 * **And there was no completion.** A block had a start and no end. Nothing said
 * "that's the block", nothing offered the next one, and the only way forward
 * was to find "Generate a new block" on your own.
 *
 * So the week is now derived from the calendar AND from what was logged, and
 * the end of a block is a state the UI can act on.
 */

export interface WeekLogShape {
  week: number;
  completed: boolean;
}

export interface ProgramWeekState {
  /** The week to show, clamped to the block and never running ahead of progress. */
  currentWeek: number;
  /** What the calendar alone would say. Uncapped — can exceed the block. */
  calendarWeek: number;
  /** The block's last week is behind us by the calendar. */
  isPastEnd: boolean;
  /** Completed sessions in the whole block. */
  sessionsDone: number;
  /** The furthest week with a completed session, or 0. */
  lastWeekTrained: number;
  /**
   * Weeks the calendar has moved on without the athlete. 0 when they are level
   * or ahead. This is the number the UI apologises with, not punishes with.
   */
  weeksBehind: number;
  /** The block is over — time to offer the next one. */
  readyForNext: boolean;
}

const DAY_MS = 86_400_000;

/** Whole days between two dates, by local calendar day, never negative. */
const daysSince = (startedOn: string, now: Date): number => {
  const s = new Date(startedOn);
  if (Number.isNaN(s.getTime())) return 0;
  const startMidnight = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.max(0, Math.floor((nowMidnight - startMidnight) / DAY_MS));
};

export const programWeekState = (opts: {
  startedOn?: string | null;
  weeks?: number | null;
  logs?: WeekLogShape[] | null;
  now?: Date;
}): ProgramWeekState => {
  const totalWeeks = Math.max(1, Math.trunc(opts.weeks ?? 4));
  const now = opts.now ?? new Date();
  const calendarWeek = opts.startedOn
    ? Math.floor(daysSince(opts.startedOn, now) / 7) + 1
    : 1;

  const done = (opts.logs ?? []).filter((l) => l.completed);
  const sessionsDone = done.length;
  const lastWeekTrained = done.reduce((max, l) => Math.max(max, l.week), 0);

  // Never more than one week ahead of real progress. Someone who trained week 1
  // and disappeared for a month comes back to week 2, not week 5 — the block
  // waits for them instead of leaving them behind in loads they never built up
  // to. Someone who has logged nothing stays on week 1.
  const progressCeiling = lastWeekTrained + 1;
  const currentWeek = Math.min(
    totalWeeks,
    Math.max(1, Math.min(calendarWeek, progressCeiling)),
  );

  const isPastEnd = calendarWeek > totalWeeks;
  const weeksBehind = Math.max(0, Math.min(calendarWeek, totalWeeks) - currentWeek);

  // Over when the calendar has left the block behind, or when the athlete has
  // trained in its final week — whichever comes first. Finishing early should
  // not mean waiting out the clock to be offered what is next.
  const readyForNext = isPastEnd || lastWeekTrained >= totalWeeks;

  return {
    currentWeek,
    calendarWeek,
    isPastEnd,
    sessionsDone,
    lastWeekTrained,
    weeksBehind,
    readyForNext,
  };
};
