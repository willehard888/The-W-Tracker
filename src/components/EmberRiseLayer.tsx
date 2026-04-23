import { useMemo } from "react";
import type { FireEvent } from "@/hooks/use-tribe-fire-reactor";

interface EmberRiseLayerProps {
  events: FireEvent[];
  accent: string;
}

/**
 * GPU-only overlay rendered inside TribeCollectiveFlame's hero variant.
 * Each `FireEvent` spawns:
 *   • a floating "+1" chip rising via `@keyframes ember-rise`
 *   • a burst of 6 randomized embers drifting up via `@keyframes ember-drift`
 *   • a faint "@username +N" caption fading in/out
 *
 * No JS animation — everything is CSS, so this layer costs ~zero.
 */
const EmberRiseLayer = ({ events, accent }: EmberRiseLayerProps) => {
  // Stable per-event particle config so the same event always renders the
  // same burst (otherwise React re-randomizes on parent re-render).
  const particles = useMemo(() => {
    return events.map((e) => {
      const seed = e.id;
      const rand = (i: number) => {
        // simple deterministic hash → [0, 1)
        let h = 0;
        const s = seed + ":" + i;
        for (let j = 0; j < s.length; j++) h = (h * 31 + s.charCodeAt(j)) >>> 0;
        return (h % 1000) / 1000;
      };
      const burst = Array.from({ length: 6 }).map((_, i) => ({
        leftPct: 38 + rand(i) * 24, // cluster around the candle root
        size: 2 + Math.round(rand(i + 99) * 3),
        delay: rand(i + 7) * 0.18,
        duration: 1.4 + rand(i + 13) * 0.6,
        drift: (rand(i + 3) - 0.5) * 28, // px sideways drift
      }));
      return { id: e.id, burst };
    });
  }, [events]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {events.map((e, idx) => {
        const cfg = particles[idx];
        return (
          <div key={e.id} className="absolute inset-0">
            {/* +N chip rising from candle root */}
            <span
              className="absolute left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full font-display font-black text-sm tabular-nums"
              style={{
                bottom: "26%",
                color: accent,
                background: accent.replace(")", " / 0.10)"),
                border: `1px solid ${accent.replace(")", " / 0.55)")}`,
                boxShadow: `0 0 18px ${accent.replace(")", " / 0.55)")}`,
                animation: "ember-rise 1.6s cubic-bezier(.2,.8,.2,1) forwards",
                willChange: "transform, opacity",
              }}
            >
              +{e.delta}
            </span>

            {/* Username caption fading in below the chip */}
            {e.username && (
              <span
                className="absolute left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest font-bold text-foreground/70"
                style={{
                  bottom: "20%",
                  animation: "ember-rise 1.6s cubic-bezier(.2,.8,.2,1) 0.05s forwards",
                  opacity: 0,
                  willChange: "transform, opacity",
                }}
              >
                @{e.username}
              </span>
            )}

            {/* Ember particle burst */}
            {cfg?.burst.map((p, i) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${p.leftPct}%`,
                  bottom: "18%",
                  width: p.size,
                  height: p.size,
                  background: accent,
                  boxShadow: `0 0 ${4 + p.size}px ${accent.replace(")", " / 0.85)")}`,
                  opacity: 0,
                  // re-use the existing ember-drift keyframe (defined in TribeCollectiveFlame area)
                  animation: `ember-rise ${p.duration}s ease-out ${p.delay}s forwards`,
                  // sideways drift via CSS variable trick — simpler: nudge left
                  transform: `translateX(${p.drift}px)`,
                  willChange: "transform, opacity",
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
