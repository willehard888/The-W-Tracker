import { useMemo } from "react";
import type { FireEvent } from "@/hooks/use-tribe-fire-reactor";

interface EmberRiseLayerProps {
  events: FireEvent[];
  accent: string;
}

/**
 * v2 — Cinematic GPU-only fire feedback overlay.
 *
 * Each `FireEvent` spawns a layered reaction at the candle root:
 *   • Shockwave ring expanding outward (scale + fade)
 *   • A flash bloom that brightens the whole flame area
 *   • A floating "+N" chip that arcs upward
 *   • A username caption below the chip
 *   • A burst of 14 randomized embers with arcing trajectories
 *   • 3 thin "fire trail" streaks that whip up like sparks
 *
 * No JS animation — everything is CSS. Zero re-render cost.
 */
const EmberRiseLayer = ({ events, accent }: EmberRiseLayerProps) => {
  // Stable per-event particle config so the same event always renders the
  // same burst (otherwise React re-randomizes on parent re-render).
  const particles = useMemo(() => {
    return events.map((e) => {
      const seed = e.id;
      const rand = (i: number) => {
        let h = 0;
        const s = seed + ":" + i;
        for (let j = 0; j < s.length; j++) h = (h * 31 + s.charCodeAt(j)) >>> 0;
        return (h % 1000) / 1000;
      };
      const burst = Array.from({ length: 14 }).map((_, i) => ({
        leftPct: 30 + rand(i) * 40,
        size: 1.5 + Math.round(rand(i + 99) * 4),
        delay: rand(i + 7) * 0.22,
        duration: 1.6 + rand(i + 13) * 0.9,
        drift: (rand(i + 3) - 0.5) * 56,
        rotate: (rand(i + 19) - 0.5) * 80,
      }));
      const trails = Array.from({ length: 3 }).map((_, i) => ({
        leftPct: 38 + i * 12,
        delay: 0.05 + i * 0.06,
        skew: (rand(i + 41) - 0.5) * 14,
      }));
      return { id: e.id, burst, trails };
    });
  }, [events]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {events.map((e, idx) => {
        const cfg = particles[idx];
        return (
          <div key={e.id} className="absolute inset-0">
            {/* 1. Shockwave ring — expanding pulse from candle root */}
            <span
              className="absolute left-1/2 -translate-x-1/2 rounded-full border-2"
              style={{
                bottom: "12%",
                width: 24,
                height: 24,
                borderColor: accent.replace(")", " / 0.9)"),
                boxShadow: `0 0 24px ${accent.replace(")", " / 0.65)")}`,
                animation: "fire-shockwave 1.1s cubic-bezier(.2,.8,.2,1) forwards",
                willChange: "transform, opacity",
              }}
            />

            {/* 2. Brightness flash bloom */}
            <span
              className="absolute left-1/2 -translate-x-1/2 rounded-full"
              style={{
                bottom: "8%",
                width: 120,
                height: 120,
                background: `radial-gradient(circle, ${accent.replace(")", " / 0.55)")} 0%, ${accent.replace(")", " / 0.10)")} 45%, transparent 75%)`,
                filter: "blur(8px)",
                mixBlendMode: "screen",
                animation: "fire-flash-bloom 720ms cubic-bezier(.2,.8,.2,1) forwards",
                willChange: "transform, opacity",
              }}
            />

            {/* 3. Fire trail whips — thin arcing streaks */}
            {cfg?.trails.map((tr, i) => (
              <span
                key={`trail-${i}`}
                className="absolute rounded-full"
                style={{
                  left: `${tr.leftPct}%`,
                  bottom: "16%",
                  width: 2,
                  height: 24,
                  background: `linear-gradient(180deg, transparent, ${accent} 50%, ${accent.replace(")", " / 0.0)")})`,
                  boxShadow: `0 0 8px ${accent}, 0 0 14px ${accent.replace(")", " / 0.6)")}`,
                  filter: "blur(0.6px)",
                  transform: `skewX(${tr.skew}deg)`,
                  animation: `fire-trail-whip 900ms cubic-bezier(.2,.8,.2,1) ${tr.delay}s forwards`,
                  opacity: 0,
                  willChange: "transform, opacity",
                  mixBlendMode: "screen",
                }}
              />
            ))}

            {/* 4. +N chip rising from candle root */}
            <span
              className="absolute left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full font-display font-black text-base tabular-nums"
              style={{
                bottom: "26%",
                color: "hsl(var(--background))",
                background: accent,
                border: `1px solid ${accent.replace(")", " / 0.9)")}`,
                boxShadow: `0 0 28px ${accent.replace(")", " / 0.85)")}, 0 0 14px hsl(0 0% 100% / 0.4)`,
                animation: "ember-rise-chip 1.6s cubic-bezier(.2,.8,.2,1) forwards",
                willChange: "transform, opacity",
                textShadow: "0 1px 0 hsl(0 0% 0% / 0.25)",
              }}
            >
              +{e.delta}
            </span>

            {/* 5. Username caption fading in below the chip */}
            {e.username && (
              <span
                className="absolute left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest font-black"
                style={{
                  bottom: "20%",
                  color: accent,
                  textShadow: `0 0 8px ${accent.replace(")", " / 0.8)")}`,
                  animation: "ember-rise 1.6s cubic-bezier(.2,.8,.2,1) 0.12s forwards",
                  opacity: 0,
                  willChange: "transform, opacity",
                  whiteSpace: "nowrap",
                }}
              >
                @{e.username}
              </span>
            )}

            {/* 6. Big ember burst — randomized arcing particles */}
            {cfg?.burst.map((p, i) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${p.leftPct}%`,
                  bottom: "16%",
                  width: p.size,
                  height: p.size,
                  background: i % 3 === 0 ? "hsl(48 100% 88%)" : accent,
                  boxShadow: `0 0 ${4 + p.size * 2}px ${accent}, 0 0 ${8 + p.size * 3}px ${accent.replace(")", " / 0.65)")}`,
                  opacity: 0,
                  ["--ember-x" as string]: `${p.drift}px`,
                  ["--ember-r" as string]: `${p.rotate}deg`,
                  animation: `fire-ember-arc ${p.duration}s cubic-bezier(.2,.8,.2,1) ${p.delay}s forwards`,
                  transform: "translateZ(0)",
                  willChange: "transform, opacity",
                  mixBlendMode: "screen",
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default EmberRiseLayer;
