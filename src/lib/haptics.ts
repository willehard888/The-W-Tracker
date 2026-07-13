import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNativePlatform } from "@/lib/platform";

// The shared <Button> fires a tap haptic on every click, and many handlers ALSO
// fire one explicitly — which stacked into a double "buzz" on a single tap.
// Coalesce tap-type haptics (impact + selection) within a short window so one
// tap = one crisp tap. Notifications (success/warning/error) are exempt: they're
// distinct semantic events meant to be felt separately (e.g. tap → then success).
const TAP_COALESCE_MS = 70;
let lastTapAt = -Infinity;
const shouldCoalesceTap = (): boolean => {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastTapAt < TAP_COALESCE_MS) return true;
  lastTapAt = now;
  return false;
};

export const hapticImpact = async (style: "light" | "medium" | "heavy" = "medium") => {
  if (!isNativePlatform()) return;
  if (shouldCoalesceTap()) return;
  try {
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: map[style] });
  } catch {}
};

export const hapticNotification = async (type: "success" | "warning" | "error" = "success") => {
  if (!isNativePlatform()) return;
  try {
    const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error };
    await Haptics.notification({ type: map[type] });
  } catch {}
};

export const hapticSelection = async () => {
  if (!isNativePlatform()) return;
  if (shouldCoalesceTap()) return;
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch {}
};
