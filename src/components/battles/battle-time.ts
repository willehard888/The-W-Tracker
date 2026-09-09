const DAY = 86_400_000;

/**
 * Whole days until a battle ends, never negative. Three files used to carry
 * this ceil-division inline; a battle that has not started counts from now.
 */
export const daysLeft = (
  startedAt: string | null | undefined,
  durationDays: number,
  now: number = Date.now(),
): number => {
  const start = startedAt ? new Date(startedAt).getTime() : now;
  return Math.max(0, Math.ceil((start + durationDays * DAY - now) / DAY));
};

/** The opening line of a live battle: "3 days left against @name." */
export const daysLeftLine = (days: number, against: string): string =>
  days === 0
    ? `Final day against ${against}.`
    : days === 1
      ? `1 day left against ${against}.`
      : `${days} days left against ${against}.`;
