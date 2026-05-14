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

  // NOTE: We previously used @capacitor/keyboard to set resize=none + scroll
  // off + smooth-scroll the focused input into view. The plugin's Objective-C
  // sources (`Keyboard.m`, `KeyboardPlugin.m`) repeatedly broke Xcode Cloud
  // builds 781–785 with `Module 'Capacitor' not found` because Xcode 26.5's
  // parallel scheduler races Keyboard's clang compile against Capacitor's
  // framework build. The polish gain wasn't worth a week of TestFlight
  // outage — falling back to Capacitor's default keyboard handling is
  // perfectly usable (slight layout adjustment when keyboard opens, but
  // nothing broken). If we need the polish back later we can ship a tiny
  // custom plugin or wait for upstream to switch keyboard to pure Swift.
  //
  // Lightweight fallback: focus → scrollIntoView ourselves on every input
  // focus event. Works on every platform, no native plugin needed.
  if (typeof document !== "undefined") {
    document.addEventListener("focusin", (e) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable) {
        window.setTimeout(() => {
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }, 250);
      }
    });
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
