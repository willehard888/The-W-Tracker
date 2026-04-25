import { useEffect, useId, useMemo, useRef } from "react";

/**
 * EdgeFireThreads — globaali tulisäikeiden kerros joka render\u00f6i
 * 5 hehkuvaa, vetelevää tulisäiettä joka neljään reunaan (top, bottom,
 * left, right) = 20 säiettä yhteensä. Kiinteäpaikkainen, fixed inset-0,
 * pointer-events: none, mix-blend-mode: screen.
 *
 * MILLISEKUNNINTARKKA KOSKETUSREAKTIO:
 *  - pointermove → kirjoitetaan globaalit CSS-muuttujat:
 *      --eft-px, --eft-py        (0..1 pointer position)
 *      --eft-active              (0|1)
 *      --eft-pulse               (0..1 momentary tap pulse, decays)
 *  - jokainen säie laskee oma "läheisyys" ja taipuu pointtia kohti
 *    suoraan transformissa CSS calc():lla. Ei React-rerenderiä,
 *    pelkät GPU-tasoiset muutokset → vaste on natiivin nopea.
 *  - pointerdown → tap-pulse (kirkas välähdys + amplitudi-spike)
 *  - pointermove on raw, ilman throttlea — pointer-eventit tulevat
 *    selaimesta jo ~120-240 Hz tahdissa joka on millisekuntien luokkaa.
 *
 * Säikeet käyttävät kahta SVG-feTurbulence-suotinta orgaaniseen
 * "elävän tulen" liikkeeseen + CSS-keyframes lievään pystysuoraan
 * skaalaan. Reduced-motion → render\u00f6idään mutta ilman jitteriä.
 */

interface ThreadConfig {
  side: "top" | "bottom" | "left" | "right";
  /** Position pitkin reunaa, 0..1 */
  pos: number;
  /** Säikeen pituus pikseleinä */
  length: number;
  /** Säikeen leveys */
  width: number;
  /** Animation phase delay seconds */
  phase: number;
  /** Color tint: 0=core gold, 1=ember orange, 2=lava red */
  tint: number;
  /** Animation speed multiplier */
  speed: number;
}

const buildThreads = (): ThreadConfig[] => {
  const threads: ThreadConfig[] = [];
  const sides: ThreadConfig["side"][] = ["top", "bottom", "left", "right"];
  // 5 säiettä per reuna = 20 yhteensä
  for (const side of sides) {
    for (let i = 0; i < 5; i++) {
      const pos = (i + 0.5) / 5; // 0.1, 0.3, 0.5, 0.7, 0.9
      threads.push({
        side,
        pos,
        // Asymmetrinen pituus — keskimmäiset pisimmät, reunat lyhyemmät
        length: 110 + Math.sin(pos * Math.PI) * 70 + Math.random() * 30,
        width: 14 + Math.random() * 8,
        phase: i * 0.4 + (side === "top" || side === "bottom" ? 0 : 0.7),
        tint: i % 3,
        speed: 0.8 + Math.random() * 0.6,
      });
    }
  }
  return threads;
};

const TINT_COLORS = [
  { core: "hsl(48 100% 88%)", mid: "hsl(42 100% 62%)", outer: "hsl(28 95% 50%)" },
  { core: "hsl(40 100% 80%)", mid: "hsl(24 95% 58%)", outer: "hsl(14 90% 42%)" },
  { core: "hsl(38 100% 75%)", mid: "hsl(18 95% 54%)", outer: "hsl(6 85% 38%)" },
];

const Thread = ({ cfg, uid, idx }: { cfg: ThreadConfig; uid: string; idx: number }) => {
  const filterId = `eft-turb-${uid}-${idx}`;
  const gradId = `eft-grad-${uid}-${idx}`;
  const colors = TINT_COLORS[cfg.tint];

  // Säikeen ankkuripaikka
  const anchorStyle: React.CSSProperties = {};
  if (cfg.side === "top") {
    anchorStyle.top = 0;
    anchorStyle.left = `${cfg.pos * 100}%`;
    anchorStyle.transform = "translateX(-50%) rotate(180deg)";
    anchorStyle.transformOrigin = "center top";
  } else if (cfg.side === "bottom") {
    anchorStyle.bottom = 0;
    anchorStyle.left = `${cfg.pos * 100}%`;
    anchorStyle.transform = "translateX(-50%)";
    anchorStyle.transformOrigin = "center bottom";
  } else if (cfg.side === "left") {
    anchorStyle.left = 0;
    anchorStyle.top = `${cfg.pos * 100}%`;
    anchorStyle.transform = "translateY(-50%) rotate(90deg)";
    anchorStyle.transformOrigin = "center left";
  } else {
    anchorStyle.right = 0;
    anchorStyle.top = `${cfg.pos * 100}%`;
    anchorStyle.transform = "translateY(-50%) rotate(-90deg)";
    anchorStyle.transformOrigin = "center right";
  }

  // Pointer-reaktio: lasketaan CSS-vars-pohjainen taipuma joka päivittyy
  // GPU:n tasolla. Kullakin reunalla eri akseli (top/bottom = X, left/right = Y).
  // Reaktion voimakkuus on suurempi kun pointer on lähellä säiettä.
  // Säikeen "x-paikka" (0..1 omalla akselillaan)
  const sx = cfg.pos;
  // Pointer-axis-arvo: top/bottom käyttää px:ää, left/right käyttää py:tä
  const pointerAxisVar = cfg.side === "top" || cfg.side === "bottom" ? "var(--eft-px,0.5)" : "var(--eft-py,0.5)";
  const pointerCrossVar = cfg.side === "top" || cfg.side === "bottom" ? "var(--eft-py,0.5)" : "var(--eft-px,0.5)";

  // Taipumakulma: -18..+18 deg riippuen pointerin etäisyydestä säikeestä
  // ((pointer - sx) * 36) clamped. Vaikutus laskee pointerCross-akselilla
  // (mitä lähempänä reunaa pointer on, sitä voimakkaampi vaikutus).
  // Reaaliaikareaktio CSS:llä — ei JS-laskentaa per frame.
  const isLeft = cfg.side === "left";
  const isTop = cfg.side === "top";
  // proximity = 1 - cross-distance (top: pointer-y pieni, bottom: pointer-y suuri jne.)
  let proximityCalc: string;
  if (cfg.side === "top") proximityCalc = "max(0, 1 - var(--eft-py,0.5) * 1.6)";
  else if (cfg.side === "bottom") proximityCalc = "max(0, (var(--eft-py,0.5) - 0.4) * 1.6)";
  else if (cfg.side === "left") proximityCalc = "max(0, 1 - var(--eft-px,0.5) * 1.6)";
  else proximityCalc = "max(0, (var(--eft-px,0.5) - 0.4) * 1.6)";

  // Taipumakulma: deltaaksi pointer-axis vs säikeen sx, kerrottuna proximityllä
  const tiltCalc = `calc((${pointerAxisVar} - ${sx}) * 60deg * (${proximityCalc}) * var(--eft-active,0))`;
  // Pituus-spike pulsesta + proximitysta
  const stretchCalc = `calc(1 + (${proximityCalc}) * 0.45 * var(--eft-active,0) + var(--eft-pulse,0) * 0.6)`;
  // Kirkkausboost
  const brightnessCalc = `calc(1 + (${proximityCalc}) * 0.8 * var(--eft-active,0) + var(--eft-pulse,0) * 1.2)`;

  return (
    <div
      className="absolute eft-thread-breathe"
      style={{
        ...anchorStyle,
        width: cfg.width * 4,
        height: cfg.length,
        willChange: "transform, filter, opacity",
        animationDelay: `${cfg.phase}s`,
        animationDuration: `${(2.4 / cfg.speed).toFixed(2)}s`,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          transformOrigin: "center bottom",
          // CSS-only millisecond-tarkka pointer-reaktio (transformsia ei
          // päällekirjoita keyframe — keyframe vain pulssaa opacity/filter ulkokuorta)
          transform: `rotate(${tiltCalc}) scaleY(${stretchCalc})`,
          filter: `brightness(${brightnessCalc})`,
          willChange: "transform, filter",
        }}
      >
        <svg
          viewBox="0 0 40 140"
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <filter id={filterId} x="-30%" y="-10%" width="160%" height="120%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.022 0.06"
                numOctaves="2"
                seed={idx}
              >
                <animate
                  attributeName="baseFrequency"
                  dur={`${(3.5 / cfg.speed).toFixed(2)}s`}
                  values="0.022 0.06; 0.04 0.09; 0.022 0.06"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" scale="6" />
            </filter>
            <linearGradient id={gradId} x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stopColor={colors.outer} stopOpacity="0" />
              <stop offset="15%" stopColor={colors.outer} stopOpacity="0.85" />
              <stop offset="45%" stopColor={colors.mid} stopOpacity="0.95" />
              <stop offset="78%" stopColor={colors.core} stopOpacity="0.9" />
              <stop offset="100%" stopColor={colors.core} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M20 140 C 14 110, 6 88, 12 60 C 16 38, 24 22, 20 0 C 16 22, 24 38, 28 60 C 34 88, 26 110, 20 140 Z"
            fill={`url(#${gradId})`}
            filter={`url(#${filterId})`}
            style={{ mixBlendMode: "screen" }}
          />
          {/* Sisempi kirkas ydin */}
          <path
            d="M20 140 C 18 100, 14 70, 18 40 C 19 24, 21 14, 20 0 C 19 14, 21 24, 22 40 C 26 70, 22 100, 20 140 Z"
            fill={colors.core}
            opacity="0.55"
            filter={`url(#${filterId})`}
            style={{ mixBlendMode: "screen" }}
          />
        </svg>
      </div>
    </div>
  );
};

interface EdgeFireThreadsProps {
  /** Globaali intensiteettikerroin, 0..1. Default 1. */
  intensity?: number;
}

const EdgeFireThreads = ({ intensity = 1 }: EdgeFireThreadsProps) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const threads = useMemo(() => buildThreads(), []);
  const layerRef = useRef<HTMLDivElement | null>(null);

  // Pointer-reaktiivisuus: kirjoitetaan globaalit CSS-vars suoraan
  // <html>-elementtiin. Ei throttlea — selaimen pointer-eventit
  // (~120-240 Hz iOS:ssa, ~60-120 Hz desktopissa) saavutetaan
  // millisekuntien tarkkuudella.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    let pulseDecayRaf = 0;
    let pulse = 0;
    let lastPulseT = 0;

    root.style.setProperty("--eft-px", "0.5");
    root.style.setProperty("--eft-py", "0.5");
    root.style.setProperty("--eft-active", "0");
    root.style.setProperty("--eft-pulse", "0");

    const onPointerMove = (e: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const px = Math.max(0, Math.min(1, e.clientX / w));
      const py = Math.max(0, Math.min(1, e.clientY / h));
      // Suora kirjoitus — selain päivittää CSS-laskelmat välittömästi
      root.style.setProperty("--eft-px", px.toFixed(3));
      root.style.setProperty("--eft-py", py.toFixed(3));
      root.style.setProperty("--eft-active", "1");
    };

    const onPointerLeave = () => {
      root.style.setProperty("--eft-active", "0");
    };

    const decayPulse = () => {
      const now = performance.now();
      const dt = Math.min(50, now - lastPulseT);
      lastPulseT = now;
      // Eksponentiaalinen sammutus, ~600 ms half-life
      pulse *= Math.pow(0.5, dt / 250);
      if (pulse < 0.005) {
        pulse = 0;
        root.style.setProperty("--eft-pulse", "0");
        pulseDecayRaf = 0;
        return;
      }
      root.style.setProperty("--eft-pulse", pulse.toFixed(3));
      pulseDecayRaf = requestAnimationFrame(decayPulse);
    };

    const onPointerDown = (e: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      root.style.setProperty("--eft-px", (e.clientX / w).toFixed(3));
      root.style.setProperty("--eft-py", (e.clientY / h).toFixed(3));
      root.style.setProperty("--eft-active", "1");
      pulse = Math.min(1, pulse + 0.85);
      lastPulseT = performance.now();
      root.style.setProperty("--eft-pulse", pulse.toFixed(3));
      if (!pulseDecayRaf) pulseDecayRaf = requestAnimationFrame(decayPulse);
    };

    // Käytä window-tasoa — ei rajoitu vain layerille (joka on pointer-events:none)
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("pointercancel", onPointerLeave, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("pointercancel", onPointerLeave);
      if (pulseDecayRaf) cancelAnimationFrame(pulseDecayRaf);
    };
  }, []);

  return (
    <div
      ref={layerRef}
      aria-hidden
      className="fixed inset-0 pointer-events-none z-[1]"
      style={{
        opacity: 0.7 * intensity,
        mixBlendMode: "screen",
        contain: "strict",
      }}
    >
      {threads.map((cfg, idx) => (
        <Thread key={idx} cfg={cfg} uid={uid} idx={idx} />
      ))}
    </div>
  );
};

export default EdgeFireThreads;
