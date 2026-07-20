import { useEffect, useRef, useState } from "react";

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
 * the moment the day rolls over. While locked we also re-render on each tick so
 * the countdown stays live; while unlocked the hook causes no re-renders.
 */
export interface CheckinDay {
  /** Local date string — changes exactly at midnight. */
  todayStr: string;
  /** True when there's no check-in on the current local calendar day. */
  canCheckin: boolean;
  /** e.g. "3h 1m" until local midnight; null when unlocked. */
  timeUntilCheckin: string | null;
}

export function useCheckinDay(lastCheckinAt: string | null | undefined): CheckinDay {
  const [todayStr, setTodayStr] = useState(() => new Date().toDateString());
  const [, tick] = useState(0);
  const lockedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      const d = new Date().toDateString();
      setTodayStr((prev) => (prev === d ? prev : d));
      // Keep the countdown ticking, but only while it's actually on screen.
      if (lockedRef.current) tick((t) => t + 1);
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
        CapApp.addListener("resume", sync).then((h) => { removeResume = () => h.remove(); });
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
  lockedRef.current = !canCheckin;

  let timeUntilCheckin: string | null = null;
  if (!canCheckin) {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const diff = Math.max(0, midnight.getTime() - Date.now());
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    timeUntilCheckin = `${h}h ${m}m`;
  }

  return { todayStr, canCheckin, timeUntilCheckin };
}
