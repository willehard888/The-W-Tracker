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
  detachPointerWind();
};

/** Inject a gust — flames across the app will visibly bend & recover. */
export const triggerGust = (strength = 0.8) => {
  manualGust = Math.max(manualGust, Math.min(1, strength));
  manualGustAt = performance.now();
};

/* ── Pointer wind ──────────────────────────────────────────────────────
 * A second, much more local wind component driven by the user's cursor /
 * touch. Updates a global CSS var `--pointer-wind-x` (-1..1). Flames that
 * opt-in (via `data-flame-interactive` or by reading the var) lean toward
 * the pointer, giving fire a tactile, "I notice you" quality.
 *
 * Throttled to ~30fps. Decays to 0 when the pointer leaves the viewport.
 */
let pointerStarted = false;
let pointerLastWrite = 0;
let pointerLastVal = "";
let pointerTargetX = 0;
let pointerCurrentX = 0;
let pointerDecayRaf = 0;

const POINTER_FRAME_MS = 1000 / 30;

const writePointerVar = (val: number) => {
  const s = val.toFixed(2);
  if (s === pointerLastVal) return;
  pointerLastVal = s;
  document.documentElement.style.setProperty("--pointer-wind-x", s);
};

const pointerDecayTick = () => {
  // Smoothly chase target (so quick flicks don't snap)
  pointerCurrentX += (pointerTargetX - pointerCurrentX) * 0.18;
  writePointerVar(pointerCurrentX);
  if (Math.abs(pointerCurrentX - pointerTargetX) > 0.005 || pointerTargetX !== 0) {
    pointerDecayRaf = requestAnimationFrame(pointerDecayTick);
  } else {
    pointerDecayRaf = 0;
  }
};

const onPointerMove = (e: PointerEvent) => {
  const now = performance.now();
  if (now - pointerLastWrite < POINTER_FRAME_MS) return;
  pointerLastWrite = now;
  // Map pointer X to -1..1 based on viewport width
  const w = window.innerWidth || 1;
  const nx = (e.clientX / w) * 2 - 1;
  pointerTargetX = Math.max(-1, Math.min(1, nx));
  if (!pointerDecayRaf) pointerDecayRaf = requestAnimationFrame(pointerDecayTick);
};

const onPointerLeave = () => {
  pointerTargetX = 0;
  if (!pointerDecayRaf) pointerDecayRaf = requestAnimationFrame(pointerDecayTick);
};

export const attachPointerWind = () => {
  if (pointerStarted || typeof window === "undefined") return;
  pointerStarted = true;
  writePointerVar(0);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave, { passive: true });
  document.addEventListener("pointercancel", onPointerLeave, { passive: true });
};

export const detachPointerWind = () => {
  if (!pointerStarted) return;
  pointerStarted = false;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerleave", onPointerLeave);
  document.removeEventListener("pointercancel", onPointerLeave);
  if (pointerDecayRaf) cancelAnimationFrame(pointerDecayRaf);
  pointerDecayRaf = 0;
  pointerTargetX = 0;
  pointerCurrentX = 0;
  writePointerVar(0);
};

/** Trigger a one-shot shockwave ring on the given element (tier-up celebration). */
export const triggerFlameShockwave = (
  el: HTMLElement | null,
  color: string = "hsl(42 100% 70%)",
) => {
  if (!el || typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const ring = document.createElement("span");
  ring.style.cssText = [
    "position:absolute",
    "left:50%",
    "top:50%",
    "width:40px",
    "height:40px",
    "border-radius:9999px",
    `border:2px solid ${color}`,
    `box-shadow:0 0 24px ${color}`,
    "pointer-events:none",
    "transform:translate(-50%,-50%) scale(0.2)",
    "opacity:0.7",
    "mix-blend-mode:screen",
    "animation:flame-shockwave 800ms cubic-bezier(0.22,1,0.36,1) forwards",
    "z-index:5",
  ].join(";");
  el.appendChild(ring);
  window.setTimeout(() => ring.remove(), 850);
};
