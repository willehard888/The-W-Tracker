/**
 * Run `cb` once the browser is idle, or after `timeout` ms at the latest.
 * Returns a cancel function (usable directly as a useEffect cleanup).
 *
 * NOTE: "idle" arrives within a few hundred ms on a warm device — this is
 * "after first paint", not "in N seconds". For work that must stay off the
 * boot path for a fixed spell (tab prefetch, monitoring) use afterIdle.
 */
export const onIdle = (cb: () => void, timeout = 2000): (() => void) => {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(cb, { timeout });
    return () => cancelIdleCallback(id);
  }
  const t = setTimeout(cb, timeout);
  return () => clearTimeout(t);
};

/** Wait `delay` ms, THEN run `cb` at the next idle moment (at most `timeout` ms later). */
export const afterIdle = (cb: () => void, delay: number, timeout = 2000): (() => void) => {
  let cancelIdle: (() => void) | null = null;
  const t = setTimeout(() => { cancelIdle = onIdle(cb, timeout); }, delay);
  return () => { clearTimeout(t); cancelIdle?.(); };
};
