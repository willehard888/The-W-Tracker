const DAY = 86_400_000;

/** A calendar date ("2026-09-18") as a UTC-midnight timestamp, for day arithmetic. */
const dateMs = (isoDate: string): number => Date.parse(`${isoDate}T00:00:00Z`);

/** Today on the device's own calendar, as "YYYY-MM-DD". */
export const localToday = (now: Date = new Date()): string => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * Where a battle stands on its own calendar: day N of M, days left after
 * today, whether it has started, whether its window is over. Battles run on
 * calendar dates (start_date, end_date) since migration 20260918100000; the
 * server resolves them once the last day has ended on both clocks.
 */
export const battleDay = (
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  today: string = localToday(),
): { day: number; total: number; left: number; started: boolean; over: boolean } => {
  if (!startDate || !endDate) return { day: 0, total: 0, left: 0, started: false, over: false };
  const total = Math.round((dateMs(endDate) - dateMs(startDate)) / DAY) + 1;
  const offset = Math.round((dateMs(today) - dateMs(startDate)) / DAY);
  const day = Math.min(total, Math.max(0, offset + 1));
  return {
    day,
    total,
    left: Math.max(0, total - Math.max(0, offset + 1)),
    started: offset >= 0,
    over: offset >= total,
  };
};

/**
 * Whole days until a battle ends, never negative. Kept for battles created
 * before calendar days (no end_date); a battle that has not started counts
 * from now.
 */
export const daysLeft = (
  startedAt: string | null | undefined,
  durationDays: number,
  now: number = Date.now(),
): number => {
  const start = startedAt ? new Date(startedAt).getTime() : now;
  return Math.max(0, Math.ceil((start + durationDays * DAY - now) / DAY));
};

/** The opening line of a live battle: "Day 3 of 7 against @name." */
export const battleDayLine = (day: number, total: number, against: string): string =>
  day <= 0
    ? `Starts tomorrow against ${against}.`
    : day >= total
      ? `Final day against ${against}.`
      : `Day ${day} of ${total} against ${against}.`;

/** The opening line of a live battle: "3 days left against @name." */
export const daysLeftLine = (days: number, against: string): string =>
  days === 0
    ? `Final day against ${against}.`
    : days === 1
      ? `1 day left against ${against}.`
      : `${days} days left against ${against}.`;
