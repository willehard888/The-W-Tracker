/** 0–6 tier ladder. Tier 6 = Inferno (200d+) — the plasma ceiling above Legendary. */
export const personalStreakTier = (streak: number): number => {
  if (streak >= 200) return 6; // Inferno
  if (streak >= 100) return 5; // Legendary
  if (streak >= 60)  return 4; // Diamond
  if (streak >= 30)  return 3; // Blazing / Champion
  if (streak >= 14)  return 2; // On Fire
  if (streak >= 7)   return 1; // Heating Up
  if (streak >= 3)   return 0; // Ignited
  return -1;
};

export const isInferno = (streak: number) => personalStreakTier(streak) >= 6;


export type StreakDeadlineState = {
  expired: boolean;
  hours: number;
  mins: number;
  urgent: boolean;
};

const getLastCheckinMs = (lastCheckinAt?: string | null) => {
  if (!lastCheckinAt) return null;
  const ms = new Date(lastCheckinAt).getTime();
  return Number.isNaN(ms) ? null : ms;
};

/**
 * Whole LOCAL calendar days between two instants, counting by date only
 * (device timezone). 0 = same day, 1 = yesterday→today, etc. Uses local
 * Y/M/D construction so DST shifts and travel across timezones don't skew it.
 */
const localCalendarDaysBetween = (from: Date, to: Date): number => {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

/**
 * The streak as it should be DISPLAYED right now — not the stale stored value.
 *
 * Calendar-day model (matches the check-in window + record_checkin RPC):
 * the streak survives as long as the user checks in once per LOCAL calendar
 * day. So it stays alive when the last check-in was today (0 days ago) or
 * yesterday (1 day ago — today is still the grace day to act). The moment a
 * full calendar day is missed (≥2 days since the last check-in) it is broken,
 * and we surface 0 IMMEDIATELY on the next render — no late check-in needed.
 */
export const getEffectiveStreak = (streak: number, lastCheckinAt?: string | null) => {
  if (streak <= 0) return 0;

  const lastCheckinMs = getLastCheckinMs(lastCheckinAt);
  if (!lastCheckinMs) return streak;

  const daysSince = localCalendarDaysBetween(new Date(lastCheckinMs), new Date());
  return daysSince >= 2 ? 0 : streak;
};

/** True when the last check-in falls on the CURRENT local calendar day —
 *  i.e. today is already banked and the streak cannot be at risk before
 *  tomorrow. (The 48h deadline window alone made Home's risk banner fire
 *  right AFTER a check-in: ~34h left < the 36h "pressure" threshold.) */
export const isCheckedInToday = (lastCheckinAt?: string | null): boolean => {
  const ms = getLastCheckinMs(lastCheckinAt);
  if (!ms) return false;
  return new Date(ms).toDateString() === new Date().toDateString();
};

/**
 * Time remaining before the streak is lost. With the calendar-day model the
 * streak breaks at LOCAL midnight that starts the second day after the last
 * check-in (i.e. you have the rest of the check-in day PLUS the whole next
 * day to log again). Returns null when there's no live streak to protect.
 */
export const getStreakDeadlineState = (
  streak: number,
  lastCheckinAt?: string | null,
): StreakDeadlineState | null => {
  if (streak <= 0) return null;

  const lastCheckinMs = getLastCheckinMs(lastCheckinAt);
  if (!lastCheckinMs) return null;

  const last = new Date(lastCheckinMs);
  // Local midnight starting (last check-in's local date + 2 days).
  const lossAt = new Date(
    last.getFullYear(),
    last.getMonth(),
    last.getDate() + 2,
    0, 0, 0, 0,
  );
  const remainingMs = lossAt.getTime() - Date.now();

  if (remainingMs <= 0) {
    return { expired: true, hours: 0, mins: 0, urgent: true };
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    expired: false,
    hours,
    mins,
    urgent: hours < 6,
  };
};
