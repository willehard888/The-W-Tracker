import { toast as sonner } from "sonner";
import { hapticNotification } from "@/lib/haptics";

/**
 * The app's toast. An outcome you see is an outcome you feel: success and
 * error carry their notification haptic here, once, instead of at the call
 * site — 94 success toasts had 18 haptics next to them and 167 errors had 6.
 * Everything else on sonner's toast (info, dismiss, promise, …) passes through.
 */
export const toast = Object.assign(
  (...args: Parameters<typeof sonner>) => sonner(...args),
  sonner,
  {
    success: (...args: Parameters<typeof sonner.success>) => {
      void hapticNotification("success");
      return sonner.success(...args);
    },
    error: (...args: Parameters<typeof sonner.error>) => {
      void hapticNotification("error");
      return sonner.error(...args);
    },
    warning: (...args: Parameters<typeof sonner.warning>) => {
      void hapticNotification("warning");
      return sonner.warning(...args);
    },
  },
);
