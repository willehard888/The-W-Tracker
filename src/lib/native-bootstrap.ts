import { isNativePlatform, getPlatform } from "@/lib/platform";

/**
 * Native iOS/Android polish — applied once at app boot.
 *
 *  • StatusBar: dark content on dark gold/obsidian background, no white notch patch.
 *  • Keyboard: native resize set to "none" so layout doesn't jolt; we reveal the
 *    focused input ourselves (`scrollIntoView`) for a smooth iOS-native feel.
 *  • Body classes: adds `is-native` + `is-ios` so CSS can target safe-area /
 *    keyboard tweaks without runtime branching in components.
 *
 * Lazy-imported plugins so the web bundle stays lean (these chunks never load
 * in browser builds).
 */
export const initNativeShell = async (): Promise<void> => {
  if (typeof document !== "undefined") {
    document.body.classList.toggle("is-native", isNativePlatform());
    document.body.classList.toggle("is-ios", getPlatform() === "ios");
  }

  if (!isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Light icons on our dark obsidian background.
    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  } catch {
    /* plugin missing on build — silently skip */
  }

  try {
    const { Keyboard, KeyboardResize } = await import("@capacitor/keyboard");
    // We let CSS + per-input scrollIntoView handle the layout. Native resize
    // jumps look very un-iOS — switching to `none` keeps the shell still and
    // the BottomNav anchored.
    await Keyboard.setResizeMode({ mode: KeyboardResize.None }).catch(() => {});
    await Keyboard.setScroll({ isDisabled: true }).catch(() => {});

    // Smooth scroll the focused input into view when the keyboard opens.
    Keyboard.addListener("keyboardWillShow", () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable) {
        // Slight delay so the keyboard frame is reported.
        window.requestAnimationFrame(() => {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      }
    });
  } catch {
    /* plugin missing on build — silently skip */
  }

  // App lifecycle — when returning from background, nudge the page so any
  // throttled rAF loops (flames, ambient particles) re-engage instantly and
  // stale React Query caches refetch when relevant.
  try {
    const { App: CapApp } = await import("@capacitor/app");
    CapApp.addListener("resume", () => {
      // Triggering visibilitychange re-runs all our visibility-aware loops.
      document.dispatchEvent(new Event("visibilitychange"));
      // Custom event other modules can listen for (e.g. invalidate hot queries).
      window.dispatchEvent(new CustomEvent("native:resume"));
    });
  } catch {
    /* ignore */
  }
};
