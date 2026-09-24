import { habitDoneOnRow } from "@/lib/checkin-habits";

/**
 * Which of today's reminders already happened — read from the day's data, never
 * from a tap.
 *
 * The plan card used to be a second check-in: 3–5 missions the member ticked by
 * hand, with a "Done" toast, while the evening check-in recorded the same things
 * a few hours later. The coach reads the check-in now. Each reminder carries the
 * `protocol_id` it was built from (coach-daily-plan's 30-entry catalog); this
 * table says which check-in habit settles it. `null` = nothing in the app records
 * it, so the row stays a plain reminder.
 */
export const PROTOCOL_HABIT: Record<string, string | null> = {
  // sleep
  "sleep-7-9h": "sleep",
  "morning-light-10min": "sunlight",
  "caffeine-cutoff-8h": "caffeine_cutoff",
  "alcohol-zero-on-training": "no_alcohol",
  // movement
  "zone-2-cardio": "workout",
  "strength-2-3x": "workout",
  "vo2-intervals-1x": "workout",
  "strength-progressive-overload": "workout",
  "walk-after-meals-10min": null,
  // nutrition
  "protein-1-6g-per-kg": "protein",
  "log-meals-3x": null,
  "fiber-30g": "healthy_food",
  "hydration-30ml-kg": "hydration",
  "fasted-cardio": "workout",
  // stress / mind
  "breath-box-5min": "breathwork",
  "breath-physiological-sigh": "breathwork",
  "mindfulness-10min": "meditation",
  "nsdr-yoga-nidra-10min": "breathwork",
  "nature-2h-week": null,
  "journaling-5min": "journaling",
  "deep-work-90min": null,
  "no-phone-first-60min": "no_phone_am",
  // recovery
  "mobility-10min": "mobility",
  "sauna-20min-4x": "sauna",
  "cold-2-3min": "cold_shower",
  "sun-vitd-15min": "sunlight",
  "cwt-contrast": "cold_shower",
  "heart-rate-variability-track": null,
  // connection
  "weekly-social-2x": "connection",
  "gratitude-3x": "gratitude",
};

export interface PlanEvidence {
  /** Today's daily_checkins row, or null before the day's check-in. */
  checkin: Record<string, unknown> | null;
  /** A program session finished in the runner today. */
  trainedToday: boolean;
  /** Today's evening reflection exists. */
  reflectionToday: boolean;
  /** Habits a finished recovery routine credited today (mobility, breathwork, meditation…). */
  recoveryHabits: ReadonlySet<string>;
}

/** The check-in habit a reminder answers, or null for a plain reminder. */
export const habitFor = (protocolId: string | undefined | null): string | null =>
  protocolId ? PROTOCOL_HABIT[protocolId] ?? null : null;

/** Did the day's data already cover this habit? */
export const habitCovered = (habit: string, e: PlanEvidence): boolean => {
  if (e.recoveryHabits.has(habit)) return true;
  if (habit === "workout" && e.trainedToday) return true;
  if ((habit === "journaling" || habit === "gratitude") && e.reflectionToday) return true;
  return !!e.checkin && habitDoneOnRow(e.checkin, habit);
};

/** Ids of the reminders the day's data has settled. */
export const settledMissions = <M extends { id: string; protocol_id?: string | null }>(
  missions: readonly M[],
  e: PlanEvidence,
): Set<string> => {
  const out = new Set<string>();
  for (const m of missions) {
    const habit = habitFor(m.protocol_id);
    if (habit && habitCovered(habit, e)) out.add(m.id);
  }
  return out;
};
