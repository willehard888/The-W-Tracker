import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/**
 * "Rest is up" for a phone that is locked or in a pocket.
 *
 * The rest timer counts from a timestamp, so it is right when the athlete
 * comes back; this is what tells them to come back. Scheduled only while the
 * runner is hidden and cancelled the moment it is visible again — on screen,
 * the timer itself is the notification.
 *
 * It never asks for permission: a system sheet between two sets would be the
 * wrong moment. Permission is whatever streak reminders already earned.
 */
export const REST_DONE_ID = 48020;

export async function scheduleRestDone(at: Date, route: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  if (at.getTime() <= Date.now()) return false;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return false;
    // Same id → iOS replaces the pending request, so "+30 s" re-arms cleanly.
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_DONE_ID,
          title: "Rest is up",
          body: "Next set.",
          schedule: { at, allowWhileIdle: true },
          extra: { route, type: "rest-done" },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelRestDone(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_DONE_ID }] });
  } catch {
    /* nothing pending, or no bridge — either way there is nothing to cancel */
  }
}
