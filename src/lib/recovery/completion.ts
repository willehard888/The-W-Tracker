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

/** Record that a recovery session was finished. Idempotent within a day. */
export const markRecoveryDone = (when: Date = new Date()): void => {
  writeLocal(KEY, localDateKey(when));
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

/** The check-in habit a finished recovery session answers. */
export const RECOVERY_HABIT_KEY = "mobility";
