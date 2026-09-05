/**
 * Run `cb` once the browser is idle, or after `timeout` ms at the latest.
 * Returns a cancel function (usable directly as a useEffect cleanup).
 */
export const onIdle = (cb: () => void, timeout = 2000): (() => void) => {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(cb, { timeout });
    return () => cancelIdleCallback(id);
  }
  const t = setTimeout(cb, timeout);
  return () => clearTimeout(t);
};
