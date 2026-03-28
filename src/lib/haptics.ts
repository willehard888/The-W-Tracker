import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNativePlatform } from "@/lib/platform";

export const hapticImpact = async (style: "light" | "medium" | "heavy" = "medium") => {
  if (!isNativePlatform()) return;
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
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch {}
};
