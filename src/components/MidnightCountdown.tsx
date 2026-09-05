import { useEffect, useState } from "react";

/**
 * "3h 1m" until local midnight. Owns its own 30 s tick so only this text
 * node re-renders — the hook that used to tick re-rendered Home and the
 * check-in page every 30 s while the day was locked.
 */
export const MidnightCountdown = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight.getTime() - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return <>{`${h}h ${m}m`}</>;
};
