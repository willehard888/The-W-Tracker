import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { pushIosDebugLog } from "@/lib/ios-debug";

const STREAK_WARNING_NOTIFICATION_ID = 48003;
// Local wall-clock hour to nudge on a day the streak is at risk. Evening so the
// user still has time to act before the local calendar day ends.
const REMINDER_HOUR = 20; // 8pm device-local
const FALLBACK_TRIGGER_DELAY_MS = 60 * 1000;

interface SyncStreakWarningArgs {
  lastCheckinAt?: string | null;
  streak?: number | null;
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

export async function syncStreakWarningNotification({ lastCheckinAt, streak }: SyncStreakWarningArgs) {
  if (!Capacitor.isNativePlatform()) return;

  if (!lastCheckinAt || !streak || streak <= 0) {
    await clearStreakWarningNotification();
    return;
  }

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

  await LocalNotifications.schedule({
    notifications: [
      {
        id: STREAK_WARNING_NOTIFICATION_ID,
        title: `Keep your ${streak}-day streak`,
        body: "Check in before the day ends to keep your streak alive.",
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