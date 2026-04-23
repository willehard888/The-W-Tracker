/**
 * Shared wind state — a single rAF loop drives a global wind vector that
 * any flame in the app can lean into.
 *
 * Outputs are written to CSS custom properties on `<html>`:
 *   --wind-x      : -1 .. 1   (current lean direction)
 *   --wind-gust   :  0 .. 1   (momentary gust strength, decays fast)
 *
 * Why CSS vars: zero React re-renders for the actual visual; flames pick
 * the values up via `transform: rotate(calc(var(--wind-x) * 3deg))` etc.
 *
 * Perf:
 *   - Throttled to ~30fps (visually identical for slow drift).
 *   - Skips writes when the new value rounds to the same string as the
 *     previous one — prevents needless style recalcs across the whole tree.
 *   - Pauses entirely when the tab is hidden.
 */

let started = false;
let rafId = 0;
let lastGustAt = 0;
let nextGustIn = 9000; // ms — first gust window
let manualGust = 0;    // 0..1, set by triggerGust, decays toward 0
let manualGustAt = 0;
let lastTick = 0;
let lastX = "";
let lastGust = "";
let visible = true;

const FRAME_MS = 1000 / 30;

const noise = (t: number) => {
  // Cheap layered sine — pseudo-Perlin without the lookup tables.
  return (
    Math.sin(t * 0.00031) * 0.55 +
    Math.sin(t * 0.00097 + 1.7) * 0.28 +
    Math.sin(t * 0.0021 + 3.1) * 0.17
  );
};

const setVar = (name: string, value: string) => {
  document.documentElement.style.setProperty(name, value);
};

const tick = (now: number) => {
  rafId = requestAnimationFrame(tick);
  if (!visible) return;
  if (now - lastTick < FRAME_MS) return;
  lastTick = now;

  // Base wind drift — slow, evolving
  const x = Math.max(-1, Math.min(1, noise(now)));

  // Auto gust scheduler — every 8–14s a small natural gust spike
  const sinceGust = now - lastGustAt;
  if (sinceGust > nextGustIn) {
    lastGustAt = now;
    nextGustIn = 8000 + Math.random() * 6000;
    manualGust = Math.max(manualGust, 0.45 + Math.random() * 0.25);
    manualGustAt = now;
  }

  // Manual / scheduled gust decay
  const gustElapsed = now - manualGustAt;
  let gust = 0;
  if (manualGust > 0) {
    if (gustElapsed < 200) {
      gust = manualGust * (gustElapsed / 200);
    } else {
      gust = manualGust * Math.exp(-(gustElapsed - 200) / 600);
    }
    if (gust < 0.01) {
      manualGust = 0;
      gust = 0;
    }
  }

  // Quantize to 2 decimals — kills near-duplicate writes that still trigger
  // style recalcs but produce no visible change.
  const xStr = x.toFixed(2);
  const gStr = gust.toFixed(2);
  if (xStr !== lastX) {
    setVar("--wind-x", xStr);
    lastX = xStr;
  }
  if (gStr !== lastGust) {
    setVar("--wind-gust", gStr);
    lastGust = gStr;
  }
};

const onVisibility = () => {
  visible = !document.hidden;
};

export const startWind = () => {
  if (started || typeof window === "undefined") return;
  started = true;
  setVar("--wind-x", "0");
  setVar("--wind-gust", "0");
  document.addEventListener("visibilitychange", onVisibility);
  rafId = requestAnimationFrame(tick);
};

export const stopWind = () => {
  if (!started) return;
  started = false;
  cancelAnimationFrame(rafId);
  document.removeEventListener("visibilitychange", onVisibility);
};

/** Inject a gust — flames across the app will visibly bend & recover. */
export const triggerGust = (strength = 0.8) => {
  manualGust = Math.max(manualGust, Math.min(1, strength));
  manualGustAt = performance.now();
};
