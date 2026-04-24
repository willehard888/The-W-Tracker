import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

/**
 * Cinematic looping flame.
 *
 * Loop strategy: total = 90 frames (3s @ 30fps). Every animation period
 * divides 90 evenly (90, 45, 30, 18, 15, 10, 9). Embers are looped via
 * (frame + offset) % cycleLength so the visual state at frame 90 matches
 * frame 0 exactly.
 *
 * Composition (back-to-front):
 *   1. Black background with deep warm radial glow
 *   2. Heat-haze SVG displacement applied to a warm vignette
 *   3. Two stacked copies of the flame still — different breath rates,
 *      screen-blended for depth and shimmer
 *   4. White-hot core pulse
 *   5. Volumetric ground halo
 *   6. 18 rising embers on staggered loops
 *   7. Subtle smoke wisps drifting upward
 *   8. Cinematic vignette
 */

interface Ember {
  id: number;
  startX: number; // 0-1 across width
  drift: number; // px lateral drift over its lifetime
  lifeLength: number; // frames to live (must divide 90)
  offset: number; // start frame within cycle
  size: number;
  hue: number;
}

// Pre-baked ember field. lifeLength chosen from divisors of 90 so each ember
// completes a whole number of cycles per loop → seamless.
const EMBERS: Ember[] = Array.from({ length: 22 }).map((_, i) => {
  const lifeOptions = [45, 30, 90];
  const lifeLength = lifeOptions[i % lifeOptions.length];
  const seed = (i * 9301 + 49297) % 233280;
  const rand = (n: number) => ((seed * (n + 1)) % 233280) / 233280;
  return {
    id: i,
    startX: 0.32 + rand(1) * 0.36, // narrow band 32-68%
    drift: (rand(2) - 0.5) * 80,
    lifeLength,
    offset: Math.floor(rand(3) * lifeLength),
    size: 2 + rand(4) * 4,
    hue: rand(5) > 0.78 ? 200 : 22 + rand(6) * 25,
  };
});

export const FlameLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Use a phase variable in [0, 2π) that loops perfectly.
  const phase = (frame / durationInFrames) * Math.PI * 2;

  // Primary flame breath: scaleY 0.96 → 1.06, scaleX inverse, rotate ±1.5°
  const breathY = 1 + Math.sin(phase) * 0.05;
  const breathX = 1 - Math.sin(phase) * 0.03;
  const sway = Math.sin(phase * 2) * 1.2; // 2 sway cycles per loop

  // Secondary flame on a faster cycle (3 cycles per loop = 30 frame period)
  const flickerPhase = phase * 3;
  const flickerScale = 1 + Math.sin(flickerPhase) * 0.04;
  const flickerSway = Math.sin(flickerPhase + 1.1) * 2;
  const flickerOpacity = 0.55 + Math.sin(flickerPhase * 1.5) * 0.18;

  // White-hot core pulse (4.5 cycles per loop → period 20 frames)
  const corePulse = 0.65 + Math.sin(phase * 4.5) * 0.35;
  const coreScale = 1 + Math.sin(phase * 4.5 + 0.3) * 0.12;

  // Ground glow pulse (1.5 cycles per loop = 60-frame period... not divisor.
  // Use 3 cycles → 30-frame period.)
  const groundPulse = 0.7 + Math.sin(phase * 3 + 0.5) * 0.3;

  // Smoke drift (1 cycle per loop)
  const smokeY = Math.sin(phase) * -8;
  const smokeOpacity = 0.45 + Math.sin(phase + 0.7) * 0.15;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Background warm radial */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 75%, rgba(255, 110, 40, 0.22) 0%, rgba(120, 60, 200, 0.06) 45%, transparent 75%)",
        }}
      />

      {/* Heat-haze SVG displacement layer — soft-edged radial */}
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: 0.55 }}
      >
        <defs>
          <radialGradient id="hazeMask" cx="50%" cy="65%" r="42%">
            <stop offset="0%" stopColor="rgba(255, 140, 60, 0.55)" />
            <stop offset="55%" stopColor="rgba(255, 100, 40, 0.18)" />
            <stop offset="100%" stopColor="rgba(255, 80, 20, 0)" />
          </radialGradient>
          <filter id="heat" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={`${0.012 + Math.sin(phase) * 0.004} ${0.028 + Math.cos(phase) * 0.005}`}
              numOctaves={2}
              seed={3}
            />
            <feDisplacementMap in="SourceGraphic" scale={14} />
            <feGaussianBlur stdDeviation={2} />
          </filter>
        </defs>
        <rect width={width} height={height} fill="url(#hazeMask)" filter="url(#heat)" />
      </svg>

      {/* Volumetric ground halo */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: -height * 0.05,
          width: height * 1.4,
          height: height * 0.4,
          transform: `translateX(-50%) scaleX(${0.95 + groundPulse * 0.15}) scaleY(${groundPulse})`,
          background:
            "radial-gradient(ellipse at center, rgba(255, 130, 40, 0.7) 0%, rgba(220, 70, 30, 0.3) 35%, transparent 70%)",
          filter: "blur(28px)",
          mixBlendMode: "screen",
          opacity: groundPulse,
        }}
      />

      {/* SECONDARY flame — soft, blurred, fast flicker, behind primary */}
      <Img
        src={staticFile("images/cinematic-flame.jpg")}
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          height: height * 1.05,
          width: "auto",
          transform: `translateX(calc(-50% + ${flickerSway}px)) scaleY(${flickerScale}) scaleX(${2 - flickerScale})`,
          transformOrigin: "50% 95%",
          mixBlendMode: "screen",
          filter: `blur(2.5px) saturate(1.4) hue-rotate(-8deg) brightness(${0.9 + corePulse * 0.2})`,
          opacity: flickerOpacity,
        }}
      />

      {/* PRIMARY flame */}
      <Img
        src={staticFile("images/cinematic-flame.jpg")}
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          height: height * 1.1,
          width: "auto",
          transform: `translateX(calc(-50% + ${sway}px)) scaleY(${breathY}) scaleX(${breathX}) rotate(${sway * 0.4}deg)`,
          transformOrigin: "50% 95%",
          mixBlendMode: "screen",
          filter: `saturate(${1.15 + corePulse * 0.1}) contrast(${1.05 + corePulse * 0.08}) brightness(${0.95 + corePulse * 0.15})`,
        }}
      />

      {/* White-hot core pulse */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: height * 0.18,
          width: height * 0.34,
          height: height * 0.5,
          transform: `translateX(-50%) scale(${coreScale})`,
          background:
            "radial-gradient(ellipse at 50% 70%, rgba(255, 240, 200, 0.7) 0%, rgba(255, 160, 70, 0.3) 40%, transparent 70%)",
          filter: "blur(10px)",
          mixBlendMode: "screen",
          opacity: corePulse,
          borderRadius: "50%",
        }}
      />

      {/* Rising embers — perfect loop via modular life */}
      {EMBERS.map((e) => {
        const local = (frame + e.offset) % e.lifeLength;
        const t = local / e.lifeLength; // 0..1
        // Vertical rise from bottom to top
        const y = height - 30 - t * (height * 0.95);
        // Horizontal drift
        const x = e.startX * width + t * e.drift;
        // Opacity: fade in, hold, fade out
        const opacity = interpolate(t, [0, 0.1, 0.75, 1], [0, 1, 0.85, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        // Slight horizontal jitter from sin wave
        const jitter = Math.sin(t * Math.PI * 4 + e.id) * 6;
        return (
          <div
            key={e.id}
            style={{
              position: "absolute",
              left: x + jitter - e.size / 2,
              top: y - e.size / 2,
              width: e.size,
              height: e.size,
              borderRadius: "50%",
              backgroundColor: `hsl(${e.hue}, 100%, 75%)`,
              boxShadow: `0 0 ${e.size * 4}px hsl(${e.hue}, 100%, 60%)`,
              opacity,
            }}
          />
        );
      })}

      {/* Smoke wisps */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          width: height * 0.7,
          height: height * 0.5,
          transform: `translateX(-50%) translateY(${smokeY}px)`,
          background:
            "radial-gradient(ellipse at 50% 80%, rgba(110, 100, 130, 0.4) 0%, transparent 65%)",
          filter: "blur(20px)",
          mixBlendMode: "screen",
          opacity: smokeOpacity,
        }}
      />

      {/* Cinematic vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 80% 95% at 50% 60%, transparent 40%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
