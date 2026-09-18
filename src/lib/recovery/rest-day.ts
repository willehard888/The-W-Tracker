// Rest-day recovery: what is still worth attention, a day or two after.
//
// The post-workout answer is "what you just did". The rest-day answer cannot
// be, because there is no session to read — so it looks back over the last
// couple of days of logged work instead.
//
// It deliberately does NOT look at sleep or resting heart rate. Not because
// they would not help, but because P0 has no honest way to say "you slept
// badly" to someone whose watch was on the charger, and a recovery plan that
// treats a missing night as a bad one is worse than one that never mentions it.
import type { WorkoutSetLog } from "@/hooks/use-workout-log";
import { areaLoad, topAreas, type AreaLoad } from "./exposure";
import type { RecoveryArea } from "@/data/recovery";

/** How far back a rest day looks. Two days: yesterday, and the day before. */
export const REST_DAY_HORIZON_DAYS = 2;

/**
 * Local-date keys for today and the days before it, newest first.
 *
 * Built from a Date rather than by subtracting milliseconds, so the run of
 * dates stays right across a daylight-saving change — one day in the year is
 * 23 hours long and the arithmetic version quietly skips it.
 */
export const recentDateKeys = (days: number, from = new Date()): string[] => {
  const keys: string[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - i);
    keys.push(d.toLocaleDateString("en-CA"));
  }
  return keys;
};

/**
 * Areas loaded in the last `days` days of logged sets.
 *
 * `logged_on` is a UTC date while the keys above are local, so a late-evening
 * session can land on tomorrow's key. The horizon is wide enough that one
 * day's drift changes nothing, which is why this doesn't reach for the
 * timestamp: the precision would be false.
 */
export function recentAreaLoad(
  logs: WorkoutSetLog[],
  days = REST_DAY_HORIZON_DAYS,
  from = new Date(),
): AreaLoad[] {
  const window = new Set(recentDateKeys(days, from));
  return areaLoad(
    logs
      .filter((l) => window.has(l.logged_on))
      .map((l) => ({ slug: l.exercise_slug, name: l.exercise_name })),
  );
}

/** The rest-day areas, or `[]` when the last two days hold nothing to work from. */
export const restDayAreas = (
  logs: WorkoutSetLog[],
  days = REST_DAY_HORIZON_DAYS,
  from = new Date(),
): RecoveryArea[] => topAreas(recentAreaLoad(logs, days, from), 3);
