import { useEffect } from "react";

/**
 * Keeps the screen on while `active`.
 *
 * The runner is the one screen where the phone lies on a bench with a set
 * count on it; auto-lock mid-rest is the difference between glancing and
 * unlocking. iOS drops the lock the moment the app is hidden, so it is
 * re-requested on every return to the foreground. Every call is guarded and
 * fail-open: a browser without the API, or a denied request, changes nothing.
 */
export const useWakeLock = (active: boolean): void => {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = () => {
      if (stopped || document.visibilityState !== "visible") return;
      if (lock && !lock.released) return;
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          // The effect may have ended while the request was in flight.
          if (stopped) void l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };

    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, [active]);
};
