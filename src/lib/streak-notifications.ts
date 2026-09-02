import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { pushIosDebugLog } from "@/lib/ios-debug";
import { clampReminderHour } from "@/lib/notification-prefs";
import type { ToneId } from "@/hooks/use-athlete-profile";

const STREAK_WARNING_NOTIFICATION_ID = 48003;
const FALLBACK_TRIGGER_DELAY_MS = 60 * 1000;

// The one notification most users ever see from us — it speaks in their
// chosen coach voice (same four tones as the persona block server-side).
// Title carries the streak number: the loss being risked IS the hook.
const days = (s: number) => `${s} ${s === 1 ? "day" : "days"}`;

export const STREAK_COPY: Record<ToneId, { title: (streak: number) => string; body: string }> = {
  calm_mentor: {
    title: (s) => `${days(s)} — keep it whole`,
    body: "One check-in before midnight protects everything you've built.",
  },
  drill_sergeant: {
    title: (s) => `${s}-day streak on the line`,
    body: "Log it before midnight. You don't break here.",
  },
  scientist: {
    title: (s) => `${s}-day trend at risk`,
    body: "One 5-minute log keeps the slope positive. Missing it costs the most expensive data point.",
  },
  hype: {
    title: (s) => `🔥 ${days(s)} — don't let it die`,
    body: "One quick check-in keeps the fire alive. Still time. Go.",
  },
};

interface SyncStreakWarningArgs {
  lastCheckinAt?: string | null;
  streak?: number | null;
  /** Coach voice for the copy; defaults to calm_mentor. */
  tone?: ToneId | null;
  /** Local hour to warn at (17–22); defaults to 20. */
  hour?: number | null;
  /** streak_guard pref — false clears any pending warning. */
  enabled?: boolean;
}

/** Local Y-M-D string for a given instant (device timezone). */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A Date at local `hour:00` offset by `dayOffset` calendar days from today. */
function localTimeOnDay(dayOffset: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

export async function requestStreakNotificationPermission() {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const permission = await LocalNotifications.requestPermissions();
    return permission.display === "granted";
  } catch (error) {
    pushIosDebugLog("StreakNotification", "Failed to request local notification permission", {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function clearStreakWarningNotification() {
  if (!Capacitor.isNativePlatform()) return;

  await LocalNotifications.cancel({
    notifications: [{ id: STREAK_WARNING_NOTIFICATION_ID }],
  });
}

export async function syncStreakWarningNotification({
  lastCheckinAt,
  streak,
  tone,
  hour,
  enabled = true,
}: SyncStreakWarningArgs) {
  if (!Capacitor.isNativePlatform()) return;

  if (!enabled || !lastCheckinAt || !streak || streak <= 0) {
    await clearStreakWarningNotification();
    return;
  }

  const REMINDER_HOUR = clampReminderHour(hour);

  const lastCheckin = new Date(lastCheckinAt);
  if (Number.isNaN(lastCheckin.getTime())) return;

  const now = new Date();
  // Calendar-day model (matches the check-in window): the streak survives as
  // long as the user checks in once per LOCAL calendar day. We compute the
  // reminder in device-local time so it's correct in any timezone the user
  // travels to, and re-syncs on each app open / check-in.
  const checkedInToday = localDateKey(lastCheckin) === localDateKey(now);

  // If they already checked in today, the next at-risk day is tomorrow;
  // otherwise the streak breaks at local midnight tonight.
  let triggerAt = checkedInToday
    ? localTimeOnDay(1, REMINDER_HOUR)
    : localTimeOnDay(0, REMINDER_HOUR);

  // Not checked in today and the reminder hour has already passed → fire soon,
  // but only if there's still time before the local day ends (midnight).
  if (triggerAt.getTime() <= now.getTime()) {
    const endOfTodayMs = localTimeOnDay(1, 0).getTime(); // local midnight tonight
    const soon = now.getTime() + FALLBACK_TRIGGER_DELAY_MS;
    if (soon >= endOfTodayMs) {
      // No realistic time left to act tonight — don't nag at midnight.
      await clearStreakWarningNotification();
      return;
    }
    triggerAt = new Date(soon);
  }

  await LocalNotifications.cancel({
    notifications: [{ id: STREAK_WARNING_NOTIFICATION_ID }],
  });

  const copy = STREAK_COPY[tone ?? "calm_mentor"] ?? STREAK_COPY.calm_mentor;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: STREAK_WARNING_NOTIFICATION_ID,
        title: copy.title(streak),
        body: copy.body,
        schedule: {
          at: triggerAt,
          allowWhileIdle: true,
        },
        extra: {
          route: "/checkin",
          type: "streak-warning",
        },
      },
    ],
  });

  pushIosDebugLog("StreakNotification", "Scheduled streak warning", {
    streak,
    lastCheckinAt,
    checkedInToday,
    triggerAt: triggerAt.toISOString(),
  });
}

// ── Lapsed re-engagement (retired 2026-09-02) ───────────────────────────────
// The local +3d/+7d "we miss you" timers are gone: server-side winback-lapsed
// owns win-backs now (it knows check-ins, tiers to 3/7/14 days, and respects
// the winback pref). This cancel stays so devices that scheduled the old
// timers before this build don't double up with the server push.
const LAPSED_3D_ID = 48010;
const LAPSED_7D_ID = 48011;

export async function cancelLapsedReengagement() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: LAPSED_3D_ID }, { id: LAPSED_7D_ID }] });
  } catch (error) {
    pushIosDebugLog("LapsedReengagement", "Failed to cancel legacy timers", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}