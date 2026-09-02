/**
 * Notification preferences — client twin of profiles.notification_prefs.
 *
 * The column is loose jsonb: an ABSENT key means ON, so new categories are
 * opt-out by default and existing users never need a backfill. This parser is
 * the single place that turns whatever is in the column into a fully-populated
 * object; everything else works with the parsed shape.
 */

export const PUSH_CATEGORIES = [
  "streak_guard",
  "coach",
  "social",
  "tribe",
  "briefing",
  "winback",
] as const;

export type NotificationCategory = (typeof PUSH_CATEGORIES)[number];

export interface NotificationPrefs {
  streak_guard: boolean;
  coach: boolean;
  social: boolean;
  tribe: boolean;
  briefing: boolean;
  winback: boolean;
  /** Local hour of the streak warning, 17–22. */
  reminder_hour: number;
}

export const REMINDER_HOUR_MIN = 17;
export const REMINDER_HOUR_MAX = 22;
export const REMINDER_HOUR_DEFAULT = 20;

export const clampReminderHour = (h: unknown): number => {
  const n = typeof h === "number" && Number.isFinite(h) ? Math.round(h) : REMINDER_HOUR_DEFAULT;
  return Math.min(REMINDER_HOUR_MAX, Math.max(REMINDER_HOUR_MIN, n));
};

/** Malformed or missing input degrades to "everything on, 20:00" — never throws. */
export const getNotificationPrefs = (raw: unknown): NotificationPrefs => {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    streak_guard: obj.streak_guard !== false,
    coach: obj.coach !== false,
    social: obj.social !== false,
    tribe: obj.tribe !== false,
    briefing: obj.briefing !== false,
    winback: obj.winback !== false,
    reminder_hour: clampReminderHour(obj.reminder_hour),
  };
};
