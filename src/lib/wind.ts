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
 * `triggerGust(strength)` lets feature code (check-in success, badge unlock,
 * tribe ignition) inject a punchy gust that all flames bend into briefly.
 */

let started = false;
let rafId = 0;
let lastGustAt = 0;
let nextGustIn = 9000; // ms — first gust window
let manualGust = 0;    // 0..1, set by triggerGust, decays toward 0
let manualGustAt = 0;

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
  // Quick attack (200ms), exponential decay over ~1.6s
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

  setVar("--wind-x", x.toFixed(3));
  setVar("--wind-gust", gust.toFixed(3));

  rafId = requestAnimationFrame(tick);
};

export const startWind = () => {
  if (started || typeof window === "undefined") return;
  started = true;
  // initial values so CSS calc() never hits NaN before first frame
  setVar("--wind-x", "0");
  setVar("--wind-gust", "0");
  rafId = requestAnimationFrame(tick);
};

export const stopWind = () => {
  if (!started) return;
  started = false;
  cancelAnimationFrame(rafId);
};

/** Inject a gust — flames across the app will visibly bend & recover. */
export const triggerGust = (strength = 0.8) => {
  manualGust = Math.max(manualGust, Math.min(1, strength));
  manualGustAt = performance.now();
};
