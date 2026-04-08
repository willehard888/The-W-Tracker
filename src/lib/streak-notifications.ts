import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { pushIosDebugLog } from "@/lib/ios-debug";

const STREAK_WARNING_NOTIFICATION_ID = 48003;
const STREAK_WINDOW_MS = 48 * 60 * 60 * 1000;
const STREAK_WARNING_OFFSET_MS = 3 * 60 * 60 * 1000;
const FALLBACK_TRIGGER_DELAY_MS = 60 * 1000;

interface SyncStreakWarningArgs {
  lastCheckinAt?: string | null;
  streak?: number | null;
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

  const lastCheckinMs = new Date(lastCheckinAt).getTime();
  if (Number.isNaN(lastCheckinMs)) return;

  const deadlineMs = lastCheckinMs + STREAK_WINDOW_MS;
  const now = Date.now();

  if (deadlineMs <= now) {
    await clearStreakWarningNotification();
    return;
  }

  const preferredTriggerMs = deadlineMs - STREAK_WARNING_OFFSET_MS;
  const triggerMs = preferredTriggerMs > now ? preferredTriggerMs : now + FALLBACK_TRIGGER_DELAY_MS;

  await LocalNotifications.cancel({
    notifications: [{ id: STREAK_WARNING_NOTIFICATION_ID }],
  });

  await LocalNotifications.schedule({
    notifications: [
      {
        id: STREAK_WARNING_NOTIFICATION_ID,
        title: "Streak in danger",
        body: "Less than 3 hours left before your streak breaks. Check in now.",
        schedule: {
          at: new Date(triggerMs),
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
    triggerAt: new Date(triggerMs).toISOString(),
    deadlineAt: new Date(deadlineMs).toISOString(),
  });
}