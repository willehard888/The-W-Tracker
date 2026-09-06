import { useEffect, useState } from "react";

/**
 * The ONE source of truth for "can I check in right now?".
 *
 * The check-in window is a LOCAL CALENDAR DAY (vuorokausi) — it reopens at
 * midnight, not 24h after the last check-in. The server (`record_checkin`) and
 * the streak logic both use the calendar day; the home screen used to compute a
 * rolling 24h window instead, so a 13:22 check-in kept the home card locked
 * until 13:22 the next day while the streak warning correctly counted to
 * midnight. Both screens now share this hook so they can't diverge again.
 *
 * `new Date()` is only read at render, so a webview that stays alive across
 * midnight would keep a stale lock. We track today's local date in state and
 * re-sync on tick / focus / visibility / native resume, so the screen unlocks
 * the moment the day rolls over. The hook itself never re-renders its owner
 * except at the rollover; the live countdown is <MidnightCountdown />.
 */
export interface CheckinDay {
  /** Local date string — changes exactly at midnight. */
  todayStr: string;
  /** True when there's no check-in on the current local calendar day. */
  canCheckin: boolean;
}

export function useCheckinDay(lastCheckinAt: string | null | undefined): CheckinDay {
  const [todayStr, setTodayStr] = useState(() => new Date().toDateString());

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      const d = new Date().toDateString();
      setTodayStr((prev) => (prev === d ? prev : d));
    };
    const interval = setInterval(sync, 30_000); // catch midnight within ~30s
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    let removeResume: (() => void) | undefined;
    // Capacitor "resume" is the reliable foreground signal on iOS, where
    // window focus / visibilitychange can be flaky.
    import("@capacitor/app")
      .then(({ App: CapApp }) => {
        if (cancelled) return;
        CapApp.addListener("resume", sync).then((h) => {
          // The handle resolves async — a fast unmount can beat it here, and
          // the listener would then be registered forever on a dead tree.
          if (cancelled) { void h.remove(); return; }
          removeResume = () => h.remove();
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      removeResume?.();
    };
  }, []);

  const canCheckin =
    !lastCheckinAt || new Date(lastCheckinAt).toDateString() !== todayStr;

  return { todayStr, canCheckin };
}
