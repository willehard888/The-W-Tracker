import { useId, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  tierPalette,
  tierFlameSpeed,
  withAlpha,
  type FlamePalette,
} from "@/lib/tribe-streak";

/**
 * TribeFireLite v2 — the single tribe-fire engine, still ZERO JavaScript per
 * frame. Pure CSS transforms/opacity on 3 SVG silhouettes + light layers
 * ported from StreakFlameInline (the app's reference flame): halo bloom,
 * chiaroscuro contact shadow, white-hot core, inner fork, ground cast,
 * heart bloom, per-tier palette + speed. NO feTurbulence/feDisplacementMap —
 * that engine cost 30-50% of frame budget on mid-tier iPhones and was
 * deliberately removed from every tribe surface.
 *
 * Perf ladder via `variant`:
 *  - "mini"     (strip avatars, battle cards, ≤40px): no blur() layers, ≤3
 *               embers, no hue-rotate wrapper. Lists render up to ~23 of these.
 *  - "standard" (list rows, compact panels): + halo bloom, chiaroscuro,
 *               white-hot core, hue wash at Diamond+.
 *  - "hero"     (page heroes, 1 per page): + ground cast, molten pool,
 *               heart bloom, densest embers.
 */
interface Props {
  /** Tier -1..6 (collective or personal ladder — caller's choice). */
  tier: number;
  /** Full flame palette. Preferred — falls back to tierPalette(tier). */
  palette?: FlamePalette;
  /**
   * Legacy single-accent fallback (SplashScreen). Only used when `palette`
   * is absent: tints outer/glow while keeping the warm legacy body.
   */
  accent?: string;
  size?: number;
  variant?: "hero" | "standard" | "mini";
  className?: string;
}

const FLAME_BACK  = "M50 12 C 58 30, 72 38, 76 56 C 82 76, 78 96, 68 110 C 60 122, 54 132, 50 138 C 46 132, 40 122, 32 110 C 22 96, 18 76, 24 56 C 28 38, 42 30, 50 12 Z";
const FLAME_MID   = "M50 4 C 56 22, 66 32, 70 50 C 76 70, 72 92, 60 108 C 52 120, 50 130, 50 138 C 50 130, 40 120, 32 108 C 22 92, 24 70, 30 50 C 36 32, 48 22, 50 4 Z";
const FLAME_FRONT = "M50 -2 C 51 16, 58 28, 60 48 C 62 70, 58 94, 53 112 C 51 124, 50 132, 50 138 C 50 132, 49 124, 47 112 C 42 94, 38 70, 40 48 C 42 28, 49 16, 50 -2 Z";

const legacyAccentPalette = (accent: string): FlamePalette => ({
  base:  "hsl(10 76% 36%)",
  outer: accent,
  mid:   "hsl(28 86% 54%)",
  core:  "hsl(54 82% 86%)",
  glow:  accent,
  text:  accent,
});

const TribeFireLite = ({ tier, palette, accent, size = 200, variant = "standard", className }: Props) => {
  const uid = useId();
  const pal = palette ?? (accent ? legacyAccentPalette(accent) : tierPalette(tier));
  const t = Math.max(-1, Math.min(6, tier));
  const tierBoost = Math.max(0, t) / 6; // 0..1
  const speed = tierFlameSpeed(t);

  const isMini = variant === "mini";
  const isHero = variant === "hero";
  const isWarmPlus  = t >= 1;
  const isFirePlus  = t >= 2;
  const isBlazePlus = t >= 3;
  const isDiamond   = t >= 4;
  const isLegendary = t >= 5;
  const isFirestorm = t >= 6;

  const emberCount = isMini ? 3 : isHero ? 8 + Math.round(tierBoost * 2) : 5;
  const embers = useMemo(
    () =>
      Array.from({ length: emberCount }).map((_, i) => ({
        id: i,
        x: 30 + ((i * 47) % 40) + (i % 2 === 0 ? -8 : 8),
        // Deterministic per-index drift so embers never move in formation.
        drift: ((i * 31) % 29) - 14, // -14..+14 px
        delay: (i * 0.42) % 3,
        dur: 2.2 + (i % 4) * 0.45,
        r: 1.2 + (i % 3) * 0.6,
      })),
    [emberCount],
  );

  // Tier grows the flame; preserveAspectRatio="none" stretches the silhouette
  // into the taller container instead of letterboxing it (v1 wasted the boost
  // as empty space above the flame).
  const flameHeightPx = size * (1.15 + tierBoost * 0.25);

  // Diamond+ hue wash (aurora) / Firestorm plasma cycle — the top-tier "wow".
  const hueAnim = isMini
    ? undefined
    : isFirestorm
    ? "flame-plasma-hue 4s linear infinite"
    : isLegendary
    ? "flame-aurora-hue 6s linear infinite"
    : isDiamond
    ? "flame-aurora-hue 10s linear infinite"
    : undefined;

  return (
    <div
      className={cn("relative flex items-end justify-center", className)}
      // contain: layout only — paint containment clipped the halo bloom /
      // ground cast into a hard rectangle at the container bounds. The light
      // layers are transform/opacity-animated, so compositing stays cheap.
      style={{ width: size, height: flameHeightPx, contain: "layout", willChange: "transform" }}
      aria-hidden
    >
      {/* Chiaroscuro contact shadow — grounds the flame (Blazing+, non-mini) */}
      {isBlazePlus && !isMini && (
        <span
          className="absolute left-1/2 pointer-events-none"
          style={{
            width: size * 1.6,
            height: size * 0.22,
            bottom: -size * 0.05,
            background: "radial-gradient(ellipse at 50% 50%, hsl(0 0% 0% / 0.42) 0%, hsl(0 0% 0% / 0.18) 45%, transparent 78%)",
            filter: `blur(${Math.max(3, size * 0.06)}px)`,
            animation: `flame-chiaroscuro ${(speed * 4.2).toFixed(2)}s ease-in-out infinite`,
            transform: "translateX(-50%)",
          }}
        />
      )}

      {/* Radiant halo bloom — the flame emits light (Warm+, non-mini) */}
      {isWarmPlus && !isMini && (
        <span
          className="absolute left-1/2 bottom-0 rounded-full pointer-events-none"
          style={{
            width: size * 2.2,
            height: size * 1.6,
            background: `radial-gradient(ellipse at 50% 72%, ${withAlpha(pal.glow, 0.5)} 0%, ${withAlpha(pal.glow, 0.16)} 42%, transparent 72%)`,
            mixBlendMode: "screen",
            transform: "translate(-50%, 8%)",
            animation: `flame-halo-bloom ${(speed * 3.8).toFixed(2)}s ease-in-out infinite`,
          }}
        />
      )}

      {/* Under-glow — warm pool at the base (all tiers) */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: size * 0.6,
          background: `radial-gradient(ellipse 80% 60% at 50% 100%, ${withAlpha(pal.glow, 0.28)} 0%, ${withAlpha(pal.glow, 0.09)} 38%, transparent 72%)`,
          ...(isMini ? {} : { filter: "blur(10px)" }),
          opacity: 0.45 + tierBoost * 0.3,
        }}
      />

      {/* Volumetric ground cast — light projected onto the floor (hero, Blazing+) */}
      {isHero && isBlazePlus && (
        <span
          className="absolute left-1/2 pointer-events-none"
          style={{
            width: size * 2,
            height: size * 0.34,
            bottom: -size * 0.1,
            background: `radial-gradient(ellipse at 50% 50%, ${withAlpha(pal.glow, 0.55)} 0%, transparent 75%)`,
            filter: "blur(5px)",
            mixBlendMode: "screen",
            transform: "translateX(-50%)",
            animation: `flame-ground-cast ${(speed * 4).toFixed(2)}s ease-in-out infinite`,
          }}
        />
      )}

      {/* Molten floor pool (hero, Blazing+) — ported from the old TribeFlame */}
      {isHero && isBlazePlus && (
        <span
          className="absolute left-1/2 pointer-events-none rounded-full"
          style={{
            width: size * 0.9,
            height: size * 0.12,
            bottom: -size * 0.02,
            background: `radial-gradient(ellipse at 50% 50%, ${withAlpha(pal.core, 0.75)} 0%, ${withAlpha(pal.outer, 0.4)} 45%, transparent 80%)`,
            transform: "translateX(-50%)",
            animation: "tribeflame-pool 3.6s ease-in-out infinite",
          }}
        />
      )}

      {/* Flame body — 3 palette-driven silhouettes + core + fork */}
      <div
        className="absolute inset-0"
        style={hueAnim ? { animation: hueAnim } : undefined}
      >
        <svg
          viewBox="0 0 100 140"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
        >
          <defs>
            <linearGradient id={`tfl-b-${uid}`} x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor={pal.base} stopOpacity="0.85" />
              <stop offset="40%" stopColor={pal.outer} stopOpacity="0.78" />
              <stop offset="80%" stopColor={pal.mid} stopOpacity="0.68" />
              <stop offset="100%" stopColor={pal.core} stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id={`tfl-m-${uid}`} x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor={pal.base} stopOpacity="0.95" />
              <stop offset="35%" stopColor={pal.outer} stopOpacity="0.9" />
              <stop offset="75%" stopColor={pal.mid} stopOpacity="0.85" />
              <stop offset="100%" stopColor={pal.core} stopOpacity="0.62" />
            </linearGradient>
            <linearGradient id={`tfl-f-${uid}`} x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor={pal.outer} stopOpacity="0.96" />
              <stop offset="30%" stopColor={pal.mid} stopOpacity="0.96" />
              <stop offset="65%" stopColor={pal.core} stopOpacity="0.9" />
              <stop offset="100%" stopColor="hsl(0 0% 100%)" stopOpacity="0.72" />
            </linearGradient>
            <radialGradient id={`tfl-e-${uid}`}>
              <stop offset="0%" stopColor={pal.core} stopOpacity="1" />
              <stop offset="60%" stopColor={pal.glow} stopOpacity="0.8" />
              <stop offset="100%" stopColor={pal.outer} stopOpacity="0" />
            </radialGradient>
          </defs>

          <g style={{ animation: `tfl-sway-back ${(speed * 2.9).toFixed(2)}s ease-in-out infinite`, transformOrigin: "50% 100%" }}>
            <path d={FLAME_BACK} fill={`url(#tfl-b-${uid})`} />
          </g>
          <g style={{ animation: `tfl-sway-mid ${(speed * 2.3).toFixed(2)}s ease-in-out infinite`, transformOrigin: "50% 100%" }}>
            <path d={FLAME_MID} fill={`url(#tfl-m-${uid})`} />
          </g>
          <g style={{ animation: `tfl-sway-front ${(speed * 1.7).toFixed(2)}s ease-in-out infinite`, transformOrigin: "50% 100%" }}>
            <g style={{ animation: `tfl-flicker-v2 ${speed.toFixed(2)}s ease-in-out infinite`, transformOrigin: "50% 100%" }}>
              <path d={FLAME_FRONT} fill={`url(#tfl-f-${uid})`} />
            </g>
          </g>

          {/* White-hot inner core — its own faster lick (On Fire+, non-mini) */}
          {isFirePlus && !isMini && (
            <g transform="translate(22.5 62.1) scale(0.55)">
              <g style={{ animation: `tfl-core-lick ${(speed * 0.55).toFixed(2)}s ease-in-out infinite`, transformOrigin: "50px 138px" }}>
                <path d={FLAME_FRONT} fill={pal.core} opacity="0.9" />
                <ellipse cx="50" cy="112" rx="10" ry="20" fill="hsl(0 0% 100%)" opacity="0.55" />
              </g>
            </g>
          )}

          {/* Secondary fork tongue (Legendary+, non-mini) */}
          {isLegendary && !isMini && (
            <g transform="translate(12 93.8) scale(0.32)">
              <g style={{ animation: `tfl-fork-lick ${(speed * 0.45).toFixed(2)}s ease-in-out infinite`, transformOrigin: "50px 138px" }}>
                <path d={FLAME_FRONT} fill={pal.mid} opacity="0.8" />
              </g>
            </g>
          )}

          {/* Rising embers — per-ember drift so they never move in formation */}
          {embers.map((e) => (
            <circle
              key={e.id}
              cx={e.x}
              cy={130}
              r={e.r}
              fill={`url(#tfl-e-${uid})`}
              style={{
                animation: `tfl-ember-rise ${e.dur}s linear ${e.delay}s infinite`,
                transformOrigin: "center",
                ["--tfl-ember-drift" as string]: `${e.drift}px`,
              }}
            />
          ))}
        </svg>

        {/* Heart bloom — pulsing white-hot center (hero, Diamond+) */}
        {isHero && isDiamond && (
          <span
            className="absolute left-1/2 rounded-full pointer-events-none"
            style={{
              width: size * 0.18,
              height: size * 0.26,
              bottom: size * 0.14,
              background: `radial-gradient(ellipse at 50% 60%, hsl(0 0% 100% / 0.9) 0%, ${withAlpha(pal.core, 0.6)} 45%, transparent 75%)`,
              mixBlendMode: "screen",
              transform: "translateX(-50%)",
              animation: `flame-heart-bloom ${(speed * 2).toFixed(2)}s ease-in-out infinite`,
            }}
          />
        )}

        {/* Plasma spark dots (Firestorm, non-mini) */}
        {isFirestorm && !isMini &&
          [0, 1].map((i) => (
            <span
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 3,
                height: 3,
                left: `${38 + i * 26}%`,
                bottom: size * 0.3,
                background: pal.core,
                boxShadow: `0 0 6px ${pal.glow}, 0 0 12px ${pal.glow}`,
                animation: `flame-ember-float ${(speed * (2.4 + i * 0.7)).toFixed(2)}s ease-out ${(i * 0.9).toFixed(1)}s infinite`,
                ["--ember-rise" as string]: `${-size * 1.05}px`,
              }}
            />
          ))}
      </div>
    </div>
  );
};

export default TribeFireLite;
