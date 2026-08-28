import { useEffect, useRef } from "react";
import { type FlamePalette, resolveCssColor, tierFlameSpeed } from "@/lib/tribe-streak";

/**
 * TribeFireCanvas — the premium vector flame (hero only).
 *
 * Design language: a glossy, Apple/Duolingo-grade stylized flame. One
 * confident teardrop silhouette drawn from FOUR cubic beziers (few control
 * points = silk-smooth edges), with the classic two-tone "flame inside a
 * flame": a deep ember outer body and a luminous gold inner tongue moving
 * slightly out of phase, plus a white-hot heart at the root. Motion is
 * LIQUID, not chaotic — the whole flame sways as one, the tip whips with a
 * soft S-flick, the body breathes; every parameter follows slow coordinated
 * sines. Full-resolution anti-aliased path fills — crisp, bright, sharp.
 *
 * Perf: 3 path fills + 3 sprite draws per frame, gradients cached per
 * palette — far under 1ms anywhere. DPR≤2 (1.5 low-end), rAF pauses via
 * IntersectionObserver/visibility/`paused`; prefers-reduced-motion renders
 * ONE static frame with no rAF at all.
 *
 * Palette + pulseToken flow through refs so the loop never restarts on
 * TribeDetail's realtime re-renders; the effect is keyed on [tier, size].
 * List/battle/strip surfaces keep the cheap SVG TribeFireLite.
 */

interface TribeFireCanvasProps {
  /** Tier 0..6 — or any value with `kindling` (cold hero). */
  tier: number;
  palette: FlamePalette;
  /** CSS width in px; canvas height is size * 1.35. */
  size: number;
  /** Bump to trigger a ~900ms intake surge (member checked in). */
  pulseToken?: number;
  /**
   * Cold-state mode (<30 days): a smaller, slower flame struggling to life
   * on a glowing coal bed — no tip droplet, dimmer heart. Pair with
   * KINDLING_PALETTE from tribe-streak.
   */
  kindling?: boolean;
  paused?: boolean;
  className?: string;
}

/** hsl(...) → hsl(... / a) for canvas paints (tokens pre-resolved). */
const a = (hsl: string, alpha: number) =>
  hsl.startsWith("hsl(") ? `${hsl.slice(0, -1)} / ${alpha})` : hsl;

/** Pre-render one radial glow sprite (center → edge alpha falloff). */
const makeGlow = (stops: [number, string][]): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
};

const TribeFireCanvas = ({ tier, palette, size, pulseToken, kindling = false, paused = false, className }: TribeFireCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteRef = useRef(palette);
  const surgeRef = useRef(0);
  const pausedRef = useRef(paused);

  paletteRef.current = palette;
  pausedRef.current = paused;

  // pulseToken change → intake surge, without touching the loop.
  const lastToken = useRef(pulseToken);
  useEffect(() => {
    if (pulseToken !== undefined && pulseToken !== lastToken.current) {
      lastToken.current = pulseToken;
      surgeRef.current = 1;
    }
  }, [pulseToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const w = size;
    const h = Math.round(size * 1.35);
    const mem = (navigator as { deviceMemory?: number }).deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 8;
    const lowEnd = mem <= 2 || cores <= 4;
    const dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.5 : 2);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const speedFactor = (kindling ? 0.78 : 1) * (1.85 / tierFlameSpeed(Math.max(0, tier)));
    const cx = w / 2;
    const baseY = h * (kindling ? 0.88 : 0.94); // planted on plate / coal bed
    const H0 = h * (kindling ? 0.52 : 0.8);     // resting flame height
    const W0 = w * (kindling ? 0.44 : 0.62);    // resting flame width

    // ── Palette paint (rebuilt only when the palette changes) ───────────────
    let paintKey = "";
    let outerGrad: CanvasGradient | null = null;
    let midGrad: CanvasGradient | null = null;
    let innerGrad: CanvasGradient | null = null;
    let heartGrad: CanvasGradient | null = null;
    let halo: HTMLCanvasElement | null = null;
    let pool: HTMLCanvasElement | null = null;
    let emberSprite: HTMLCanvasElement | null = null;
    let coalSprite: HTMLCanvasElement | null = null;
    const ensurePaint = () => {
      const p = paletteRef.current;
      const key = `${p.outer}|${p.core}`;
      if (key === paintKey && outerGrad) return;
      paintKey = key;
      const base = resolveCssColor(p.base);
      const outer = resolveCssColor(p.outer);
      const mid = resolveCssColor(p.mid);
      const core = resolveCssColor(p.core);
      const glow = resolveCssColor(p.glow === "transparent" ? p.outer : p.glow);
      // Outer body — deep rooted ember rising into the vivid body color.
      outerGrad = ctx.createLinearGradient(0, baseY, 0, baseY - H0);
      outerGrad.addColorStop(0, base);
      outerGrad.addColorStop(0.4, outer);
      outerGrad.addColorStop(0.85, mid);
      outerGrad.addColorStop(1, mid);
      // Mid tongue — the third tone that gives the body its color depth.
      midGrad = ctx.createLinearGradient(0, baseY, 0, baseY - H0 * 0.8);
      midGrad.addColorStop(0, outer);
      midGrad.addColorStop(0.5, mid);
      midGrad.addColorStop(1, a(core, 0.9));
      // Inner tongue — luminous, reads as the flame's living heart.
      innerGrad = ctx.createLinearGradient(0, baseY, 0, baseY - H0 * 0.62);
      innerGrad.addColorStop(0, mid);
      innerGrad.addColorStop(0.55, core);
      innerGrad.addColorStop(1, core);
      // White-hot heart at the very root.
      heartGrad = ctx.createRadialGradient(cx, baseY - H0 * 0.1, 0, cx, baseY - H0 * 0.1, W0 * 0.3);
      heartGrad.addColorStop(0, "hsl(0 0% 100% / 0.7)");
      heartGrad.addColorStop(0.45, a(core, 0.4));
      heartGrad.addColorStop(1, a(core, 0));
      halo = makeGlow([[0, a(glow, 0.3)], [0.55, a(glow, 0.1)], [1, a(glow, 0)]]);
      pool = makeGlow([[0, a(glow, 0.5)], [0.6, a(glow, 0.16)], [1, a(glow, 0)]]);
      emberSprite = makeGlow([[0, a(core, 1)], [0.45, a(mid, 0.8)], [1, a(mid, 0)]]);
      // Coal: a dark stone with an ember heart, drawn as a squashed sprite.
      coalSprite = makeGlow([
        [0, a(core, 0.9)], [0.28, a(outer, 0.85)],
        [0.55, "hsl(8 55% 16%)"], [0.85, "hsl(8 40% 9%)"], [1, "hsl(8 40% 9% / 0)"],
      ]);
    };

    /**
     * The flame silhouette: four cubic beziers around a teardrop.
     * Everything animates through slow sines — liquid, never jittery.
     *  - `flick` bends the tip into a soft S
     *  - `sway`  leans the whole upper body
     *  - `puffL/puffR` breathe the side bulges slightly out of phase
     */
    const traceFlame = (
      W: number, H: number,
      sway: number, flick: number, puffL: number, puffR: number,
      yOff = 0, xOff = 0,
    ) => {
      const bx = cx + xOff;
      const by = baseY - yOff;
      const tipX = bx + sway * W + flick * W * 0.34;
      const tipY = by - H;
      const upperSway = sway * W * 0.6;

      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      // Tip → left shoulder (concave neck, then out)
      ctx.bezierCurveTo(
        tipX - W * 0.02 - flick * W * 0.18, tipY + H * 0.14,
        bx - W * 0.16 + upperSway, by - H * 0.68,
        bx - W * (0.36 + puffL) + upperSway * 0.5, by - H * 0.42,
      );
      // Left shoulder → base center (full round belly)
      ctx.bezierCurveTo(
        bx - W * (0.52 + puffL), by - H * 0.2,
        bx - W * 0.34, by + H * 0.015,
        bx, by,
      );
      // Base center → right shoulder
      ctx.bezierCurveTo(
        bx + W * 0.34, by + H * 0.015,
        bx + W * (0.52 + puffR), by - H * 0.2,
        bx + W * (0.36 + puffR) + upperSway * 0.5, by - H * 0.42,
      );
      // Right shoulder → tip (concave neck)
      ctx.bezierCurveTo(
        bx + W * 0.16 + upperSway, by - H * 0.68,
        tipX + W * 0.02 - flick * W * 0.12, tipY + H * 0.16,
        tipX, tipY,
      );
      ctx.closePath();
    };

    // Micro-embers — few, tiny, crisp. Premium confetti, not smoke.
    const embers: { born: number; dur: number; x0: number; drift: number; s: number }[] = [];
    let lastEmber = 0;

    const draw = (now: number) => {
      ensurePaint();
      const surge = surgeRef.current;
      const t = now * 0.001 * speedFactor;

      // Coordinated liquid motion — one slow conductor, small harmonics.
      const sway = 0.045 * Math.sin(t * 1.1) + 0.02 * Math.sin(t * 2.63);
      const flick = 0.5 * Math.sin(t * 1.7 + 1.2) + 0.28 * Math.sin(t * 3.7);
      const breathe = 1 + 0.022 * Math.sin(t * 2.2) + 0.012 * Math.sin(t * 5.1);
      const rise = 1 + 0.03 * Math.sin(t * 1.45 + 0.6) + 0.1 * surge;
      const puffL = 0.02 * Math.sin(t * 2.9 + 0.4);
      const puffR = 0.02 * Math.sin(t * 2.9 + 2.5);

      ctx.clearRect(0, 0, w, h);

      // Ground pool + wrapping halo — soft additive light.
      ctx.globalCompositeOperation = "lighter";
      const poolW = w * 0.92;
      ctx.globalAlpha = 0.5 + 0.08 * Math.sin(t * 2.4) + 0.25 * surge;
      ctx.drawImage(pool!, cx - poolW / 2, baseY - poolW * 0.16, poolW, poolW * 0.32);
      const haloS = H0 * 1.16;
      ctx.globalAlpha = 0.5 + 0.06 * Math.sin(t * 1.9 + 1) + 0.18 * surge;
      ctx.drawImage(halo!, cx - haloS / 2, baseY - H0 * 0.5 - haloS / 2, haloS, haloS);
      ctx.globalCompositeOperation = "source-over";

      // Kindling: the coal mound behind the flame — ember hearts breathing.
      if (kindling) {
        const coalW = w * 0.34;
        const breatheA = 0.8 + 0.2 * Math.sin(t * 1.6);
        const breatheB = 0.8 + 0.2 * Math.sin(t * 1.9 + 2.2);
        ctx.globalAlpha = breatheA;
        ctx.drawImage(coalSprite!, cx - w * 0.34, baseY - coalW * 0.30, coalW, coalW * 0.62);
        ctx.globalAlpha = breatheB;
        ctx.drawImage(coalSprite!, cx + w * 0.02, baseY - coalW * 0.28, coalW * 1.05, coalW * 0.64);
        ctx.globalAlpha = 1;
      }

      // Outer body — one confident silhouette, crisp full-res edge.
      ctx.globalAlpha = 1;
      ctx.fillStyle = outerGrad!;
      traceFlame(W0 * breathe, H0 * rise, sway, flick, puffL, puffR);
      ctx.fill();

      // Side licks — two small tongues breathing at the flanks, filled with
      // the SAME body gradient so they merge seamlessly into the silhouette.
      const lickL = 0.5 + 0.5 * Math.sin(t * 1.35 + 0.9);
      const lickR = 0.5 + 0.5 * Math.sin(t * 1.55 + 3.6);
      ctx.fillStyle = outerGrad!;
      traceFlame(
        W0 * 0.17, H0 * (0.2 + 0.14 * lickL),
        sway * 0.6 - 0.18, 0.8 * Math.sin(t * 2.4 + 1.7), 0, 0,
        0, -W0 * 0.26,
      );
      ctx.fill();
      traceFlame(
        W0 * 0.15, H0 * (0.17 + 0.13 * lickR),
        sway * 0.6 + 0.18, 0.8 * Math.sin(t * 2.7 + 4.2), 0, 0,
        0, W0 * 0.27,
      );
      ctx.fill();

      // Mid tongue — the third tone between body and heart.
      const midFlick = 0.5 * Math.sin(t * 1.7 + 1.6) + 0.3 * Math.sin(t * 3.9 + 1.1);
      ctx.fillStyle = midGrad!;
      traceFlame(
        W0 * 0.74 * breathe, H0 * 0.76 * rise * (1 + 0.02 * Math.sin(t * 2.8 + 0.8)),
        sway * 1.08, midFlick, puffL * 0.8, puffR * 0.8,
      );
      ctx.fill();

      // Inner tongue — smaller, brighter, breathing out of phase.
      const innerFlick = 0.5 * Math.sin(t * 1.7 + 2.1) + 0.3 * Math.sin(t * 4.1 + 0.5);
      ctx.fillStyle = innerGrad!;
      traceFlame(
        W0 * 0.5 * breathe, H0 * 0.55 * rise * (1 + 0.03 * Math.sin(t * 3.3)),
        sway * 1.15, innerFlick, puffL * 0.6, puffR * 0.6,
      );
      ctx.fill();

      // White-hot heart at the root.
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (kindling ? 0.5 : 0.75) + 0.1 * Math.sin(t * 4.4) + 0.25 * surge;
      ctx.fillStyle = heartGrad!;
      ctx.beginPath();
      ctx.ellipse(cx, baseY - H0 * 0.1, W0 * 0.26, H0 * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Gloss — a thin specular crescent along the left neck (the icon sheen).
      ctx.globalAlpha = 0.14 + 0.05 * Math.sin(t * 1.9);
      ctx.strokeStyle = "hsl(0 0% 100%)";
      ctx.lineWidth = W0 * 0.035;
      ctx.lineCap = "round";
      ctx.beginPath();
      const gx = cx + sway * W0 * 0.6;
      ctx.moveTo(gx + flick * W0 * 0.2 - W0 * 0.03, baseY - H0 * 0.86 * rise);
      ctx.quadraticCurveTo(
        gx - W0 * 0.2, baseY - H0 * 0.62,
        cx - W0 * 0.3, baseY - H0 * 0.4,
      );
      ctx.stroke();

      // Tip droplet — a small teardrop pinches off and floats up, fading.
      // One continuous cycle: born at the tip, rises ~0.3H, dissolves.
      const cycle = (t * 0.28) % 1;
      if (!kindling && cycle < 0.6) {
        const d = cycle / 0.6;
        const dropS = (1 - d * 0.6);
        ctx.globalAlpha = (1 - d) * 0.85;
        ctx.fillStyle = innerGrad!;
        traceFlame(
          W0 * 0.09 * dropS, H0 * 0.07 * dropS,
          sway, flick * 0.5, 0, 0,
          H0 * rise * (1.02 + d * 0.24),
          sway * W0 + flick * W0 * 0.3,
        );
        ctx.fill();
      }

      // Micro-embers — spawn sparsely from the shoulders, rise, die crisp.
      if (now - lastEmber > 1400 / speedFactor && embers.length < 4) {
        lastEmber = now;
        embers.push({
          born: now,
          dur: 1400 + Math.random() * 800,
          x0: cx + (Math.random() < 0.5 ? -1 : 1) * W0 * (0.2 + Math.random() * 0.16),
          drift: (Math.random() - 0.5) * W0 * 0.3,
          s: (2 + Math.random() * 2.2) * (size / 160),
        });
      }
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i];
        const d = (now - e.born) / e.dur;
        if (d >= 1) { embers.splice(i, 1); continue; }
        ctx.globalAlpha = Math.pow(1 - d, 1.5) * 0.9;
        const ex = e.x0 + e.drift * d + Math.sin(t * 3 + e.born) * 3;
        const ey = baseY - H0 * (0.5 + d * 0.55);
        ctx.drawImage(emberSprite!, ex - e.s / 2, ey - e.s / 2, e.s, e.s);
      }

      // Kindling: one coal in front so the flame rises from WITHIN the mound.
      if (kindling) {
        ctx.globalCompositeOperation = "source-over";
        const coalW = w * 0.4;
        ctx.globalAlpha = 1;
        ctx.drawImage(coalSprite!, cx - coalW * 0.52, baseY - coalW * 0.16, coalW, coalW * 0.55);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    // Reduced motion: one static frame, no rAF ever.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      draw(1200);
      return;
    }

    let running = true;
    let visible = true;
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (pausedRef.current) { last = now; return; }
      const dt = Math.min(now - (last || now), 50);
      last = now;
      surgeRef.current = Math.max(0, surgeRef.current - dt / 900);
      draw(now);
    };
    const syncRunning = () => {
      const should = visible && !document.hidden;
      if (should && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
      else if (!should) { running = false; cancelAnimationFrame(raf); }
    };
    const onVisibility = () => syncRunning();
    document.addEventListener("visibilitychange", onVisibility);
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      syncRunning();
    }, { threshold: 0 });
    io.observe(canvas);

    raf = requestAnimationFrame(frame);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
    };
  }, [tier, size, kindling]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", contain: "layout" }}
      aria-hidden
    />
  );
};

export default TribeFireCanvas;
