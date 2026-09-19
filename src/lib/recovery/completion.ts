// "Did a recovery session get finished today?" — the bridge from recovery to
// the check-in, and so to XP.
//
// WHY THIS IS NOT A SERVER LOOKUP
//
// `useSessionDoneToday` reads `coach_program_logs` because that table already
// existed. `recovery_sessions` does not: its migration ships in this branch and
// nothing can write to it until it is deployed and the generated types are
// regenerated. Waiting for that would mean recovery earns nothing in the
// meantime.
//
// So the record is local, and that is safe here in a way it would not be
// elsewhere: this only PREFILLS a checkbox the athlete could tick themselves.
// The check-in is a self-report — "Mobility / stretch" has always been an
// honour-system toggle — so a value on the device opens no cheat surface that
// the toggle did not already have. It cannot inflate anything, because the
// server recomputes the score from the submitted habits either way.
//
// What it costs: check in on a different device from the one you stretched on
// and the tick is not pre-made. The athlete ticks it by hand, exactly as today.
// That is a missing convenience, not a missing reward.
import { readLocal, writeLocal } from "@/lib/storage";
import { localDateKey } from "@/lib/date";

const KEY = "recovery-done-on";

/** The check-in habit a finished recovery session answers by default. */
export const RECOVERY_HABIT_KEY = "mobility";
const LOG_KEY = "recovery-done-log";

/** Two weeks is all any screen asks for, and it keeps the value small. */
const LOG_DAYS = 14;

const readLog = (): string[] => {
  const raw = readLocal(LOG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
};

/**
 * Where the day is kept for one habit. Mobility keeps the original key, so a
 * session finished on the build before routines still ticks the card.
 */
const habitKey = (habit: string) => (habit === RECOVERY_HABIT_KEY ? KEY : `${KEY}:${habit}`);

/** The habits a routine can tick, so the check-in knows which keys to look at. */
const HABITS = [RECOVERY_HABIT_KEY, "breathwork", "meditation", "meditation_pm"] as const;

/**
 * Record that a recovery session was finished. Idempotent within a day.
 * `habit` is the check-in habit it answers: a stretch session ticks mobility,
 * a breathing routine breathwork, a meditation meditation.
 */
export const markRecoveryDone = (when: Date = new Date(), habit: string = RECOVERY_HABIT_KEY): void => {
  const key = localDateKey(when);
  writeLocal(habitKey(habit), key);
  // One entry per day, newest first, trimmed. A second session on the same day
  // is a good day, not two — the count exists to say "I do this", and counting
  // twice for one evening would make the number mean less, not more.
  const log = [key, ...readLog().filter((d) => d !== key)].slice(0, LOG_DAYS);
  try {
    writeLocal(LOG_KEY, JSON.stringify(log));
  } catch {
    // The count is a nicety; the tick on the check-in is the part that matters.
  }
};

/**
 * Days with a finished recovery session in the last seven, today included.
 *
 * Shown as a plain count and never as a target. "3 this week" says the athlete
 * is doing something; "3 / 5" would say they are behind, which is a different
 * sentence about a thing nobody agreed to.
 */
export const recoveryDaysThisWeek = (when: Date = new Date()): number => {
  const window = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date(when.getFullYear(), when.getMonth(), when.getDate() - i);
    window.add(localDateKey(d));
  }
  return readLog().filter((d) => window.has(d)).length;
};

/**
 * Was one finished today, in the athlete's own day?
 *
 * Local date, not a 24-hour window: somebody who stretches at 23:50 and checks
 * in at 00:10 has done two different days, and the check-in they are filling in
 * is for the new one.
 */
export const recoveryDoneToday = (when: Date = new Date()): boolean =>
  readLocal(KEY) === localDateKey(when);

/** Every habit a recovery session finished today has earned, for the check-in. */
export const habitsEarnedToday = (when: Date = new Date()): string[] => {
  const today = localDateKey(when);
  return HABITS.filter((h) => readLocal(habitKey(h)) === today);
};
