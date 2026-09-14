/**
 * The user's local calendar day, computed on a server that runs in UTC.
 *
 * `new Date().getFullYear()/getMonth()/getDate()` on Deno IS the UTC day —
 * coach-daily-plan called that `todayLocalISO` and stamped plans with it,
 * while the client read `plan_date = localDateKey()` (the device's day). In
 * Finland the plan built at 22:00 was dated tomorrow from 00:00–03:00 the
 * server still called today, so from midnight the row the client asked for
 * did not exist and "Build today's plan" came back every night. West of UTC
 * the same gap opened every afternoon.
 *
 * `tzOffsetMinutes` is `Date.prototype.getTimezoneOffset()` from the device —
 * minutes BEHIND UTC (Helsinki in summer = -180) — the same value the check-in
 * already sends as `p_tz_offset_minutes` and `_shared/situation.ts` consumes.
 * Pure: no Deno APIs, so the client test suite can exercise it directly.
 */

/** Clamp a client-supplied offset to the real world (UTC-14 … UTC+14). */
export const clampTzOffset = (raw: unknown): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-14 * 60, Math.min(14 * 60, Math.round(n)));
};

/** YYYY-MM-DD in the user's local calendar for the instant `nowMs`. */
export const localDayKey = (tzOffsetMinutes: number, nowMs: number = Date.now()): string =>
  new Date(nowMs - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);

/** JS weekday (Sun=0 … Sat=6) in the user's local calendar. */
export const localWeekday = (tzOffsetMinutes: number, nowMs: number = Date.now()): number =>
  new Date(nowMs - tzOffsetMinutes * 60_000).getUTCDay();
