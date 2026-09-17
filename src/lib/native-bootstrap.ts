import { isNativePlatform, getPlatform } from "@/lib/platform";

/**
 * Native iOS/Android polish — applied once at app boot.
 *
 *  • StatusBar: dark content on dark gold/obsidian background, no white notch patch.
 *  • Keyboard: native resize set to "none" so layout doesn't jolt; we reveal the
 *    focused input ourselves only when the keyboard actually covers it.
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
  // Keyboard reveal: WKWebView shrinks the VISUAL viewport (not the layout)
  // when the keyboard opens, so a field near the bottom can end up under it.
  // Scroll only when the focused field is actually covered, and instantly —
  // the old focusin + 250 ms smooth scrollIntoView fired on EVERY focus and
  // fought the keyboard's own animation.
  // Two things learned since: the resize fires many times DURING the keyboard
  // animation (each tick forced layout and fought the animation), and
  // scrollIntoView scrolls every scrollable ancestor — including the shell
  // scroller a BottomSheet has locked, which is why the page moved behind a
  // sheet whose input took focus. Once per burst, and never for a field
  // inside a dialog (the sheet's own body scroller handles those).
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (vv) {
    // A third thing learned: WebKit reveals a focused field by PANNING the
    // whole page (visualViewport.offsetTop > 0), whether or not the field
    // needed it. The app draws under the status bar, so the pan dragged the
    // page bar up into the clock: "Today · Chest" printed over "16.08" while a
    // weight was being typed, and the page behind an open sheet did the same.
    //   1. When the field already fits on screen without the pan, undo it.
    //   2. While any pan remains (a real keyboard covering the field), a strip
    //      in the page's own ground colour rides the visual viewport's top edge
    //      so nothing is ever printed over the status bar.
    const shield = document.createElement("div");
    shield.setAttribute("aria-hidden", "true");
    shield.style.cssText =
      "position:fixed;left:0;right:0;top:0;height:env(safe-area-inset-top,0px);background:hsl(var(--background));" +
      "z-index:2147483000;pointer-events:none;display:none;will-change:transform;";
    document.body.appendChild(shield);
    const syncShield = () => {
      const off = Math.max(0, vv.offsetTop);
      shield.style.display = off > 1 ? "block" : "none";
      if (off > 1) shield.style.transform = `translate3d(0, ${off}px, 0)`;
    };
    vv.addEventListener("scroll", syncShield);

    let settle: ReturnType<typeof setTimeout> | undefined;
    const reveal = () => {
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => {
        syncShield();
        const el = document.activeElement as HTMLElement | null;
        if (!el) return;
        const tag = el.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA" && !el.isContentEditable) return;
        const r = el.getBoundingClientRect();
        // Rects are in layout coordinates; without the pan the visible band
        // is [0, vv.height]. 64 clears the status bar and the page bar.
        const fitsUnpanned = r.top >= 64 && r.bottom <= vv.height - 8;
        if (vv.offsetTop > 1 && fitsUnpanned) {
          window.scrollTo(0, 0);
          syncShield();
          return;
        }
        if (el.closest('[role="dialog"]')) return;
        if (r.bottom > vv.offsetTop + vv.height - 8 || r.top < vv.offsetTop) {
          el.scrollIntoView({ block: "center", behavior: "auto" });
        }
      }, 120);
    };
    vv.addEventListener("resize", () => { syncShield(); reveal(); });
    // A hardware keyboard (and the simulator) pans without resizing anything.
    document.addEventListener("focusin", reveal);
    document.addEventListener("focusout", () => setTimeout(syncShield, 150));
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
