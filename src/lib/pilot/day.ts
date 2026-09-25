// Which day of the pilot is it for this person?
//
// Mirrors the `day` arithmetic in pilot_context() (migration 20260925120000)
// exactly, and pilot-day.test.ts proves the two agree — the same shape
// xp-parity.mjs uses to keep SQL and TS honest about the check-in score.
//
// The server is the authority: every question's eligibility is decided from the
// day the server reports. This module exists so the UI can say "day 4 of 14"
// without a round trip, and so the rule can be tested at every hour of every
// timezone without a database.
//
// Counted in the TESTER's timezone, not UTC. A checkpoint that fires at 2am
// because the server disagrees with the phone about what day it is would be the
// first thing a tester reported as a bug.

const MS_PER_DAY = 86_400_000;

/**
 * The calendar date in `timeZone`, as YYYY-MM-DD.
 *
 * en-CA because it is the locale that formats as YYYY-MM-DD; the alternative is
 * assembling the parts by hand from formatToParts, which is the same thing with
 * more places to get it wrong.
 */
const localISODate = (at: Date, timeZone: string): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
  } catch {
    // An unknown or malformed zone must not take the app down. UTC matches what
    // the SQL does with a NULL profiles.timezone.
    return at.toISOString().slice(0, 10);
  }
};

/** Whole days between two calendar dates, ignoring the clock entirely. */
const daysBetween = (fromISO: string, toISO: string): number =>
  Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / MS_PER_DAY);

/**
 * Day 0 is the day the code was redeemed. Day 1 is the next calendar day in the
 * tester's own timezone — NOT 24 hours later. Somebody who joins at 23:50 is on
 * day 1 ten minutes later, which is correct: they have seen a new day of the
 * app, and the day-1 question is about their first day, not their first
 * twenty-four hours.
 *
 * Never negative. A clock skewed backwards, or a redemption stamped slightly in
 * the future, reads as day 0 rather than as a negative day that no rule handles.
 */
export const pilotDay = (redeemedAt: string | Date, now: Date = new Date(), timeZone = "UTC"): number => {
  const from = redeemedAt instanceof Date ? redeemedAt : new Date(redeemedAt);
  if (Number.isNaN(from.getTime())) return 0;
  return Math.max(0, daysBetween(localISODate(from, timeZone), localISODate(now, timeZone)));
};

/** Still being watched? Access outlives this by design — see the migration header. */
export const inObservationWindow = (day: number, observeDays: number): boolean =>
  day >= 0 && day <= observeDays;

/** "Day 4 of 14" — the only place the pilot names itself in the UI. */
export const pilotDayLabel = (day: number, observeDays: number): string =>
  `Päivä ${Math.min(day, observeDays)} / ${observeDays}`;
