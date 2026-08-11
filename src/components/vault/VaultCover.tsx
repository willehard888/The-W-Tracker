/**
 * VaultCover — hand-crafted premium SVG cover art for each Vault category.
 * Vector (razor-sharp at any size), lightweight, and on-theme: an obsidian
 * gradient base, a warm gold floor-glow, the category's accent key-light, a
 * fine engraved grid, a tasteful category motif, and a gold hairline frame.
 * No raster assets — fits the precision direction and ships in the bundle.
 */
const GOLD = "hsl(42 78% 54%)";

const Frame = ({ id, accent, children }: { id: string; accent: string; children: React.ReactNode }) => (
  <svg viewBox="0 0 420 168" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
    <defs>
      <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stopColor="hsl(258 16% 9%)" />
        <stop offset="1" stopColor="hsl(258 20% 3.5%)" />
      </linearGradient>
      <radialGradient id={`key-${id}`} cx="0.8" cy="0.18" r="0.9">
        <stop offset="0" stopColor={accent} stopOpacity="0.42" />
        <stop offset="0.45" stopColor={accent} stopOpacity="0.10" />
        <stop offset="1" stopColor={accent} stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`gold-${id}`} cx="0.12" cy="1" r="0.9">
        <stop offset="0" stopColor={GOLD} stopOpacity="0.20" />
        <stop offset="1" stopColor={GOLD} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`scrim-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.35" stopColor="hsl(258 20% 3.5%)" stopOpacity="0" />
        <stop offset="1" stopColor="hsl(258 20% 3%)" stopOpacity="0.92" />
      </linearGradient>
    </defs>

    <rect width="420" height="168" fill={`url(#bg-${id})`} />
    {/* engraved grid */}
    <g stroke="hsl(0 0% 100%)" strokeOpacity="0.035" strokeWidth="1">
      {[42, 84, 126, 168, 210, 252, 294, 336, 378].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="168" />
      ))}
      {[42, 84, 126].map((y) => (
        <line key={y} x1="0" y1={y} x2="420" y2={y} />
      ))}
    </g>
    <rect width="420" height="168" fill={`url(#key-${id})`} />
    <rect width="420" height="168" fill={`url(#gold-${id})`} />

    {children}

    {/* bottom scrim for title legibility + gold hairline frame */}
    <rect width="420" height="168" fill={`url(#scrim-${id})`} />
    <rect x="0.5" y="0.5" width="419" height="167" fill="none" stroke={GOLD} strokeOpacity="0.18" strokeWidth="1" />
  </svg>
);

/** Performance Nutrition — a plated ring with segments + a sprig. */
const NutritionMotif = ({ accent }: { accent: string }) => (
  <g transform="translate(312 70)" fill="none" strokeLinecap="round">
    <circle r="52" stroke={accent} strokeOpacity="0.5" strokeWidth="1.5" />
    <circle r="40" stroke={GOLD} strokeOpacity="0.35" strokeWidth="1" />
    <circle r="28" stroke={accent} strokeOpacity="0.7" strokeWidth="1.5" strokeDasharray="44 14" />
    {/* three plate segments */}
    {[0, 120, 240].map((a) => (
      <line key={a} x1="0" y1="0" x2={28 * Math.cos((a * Math.PI) / 180)} y2={28 * Math.sin((a * Math.PI) / 180)} stroke={GOLD} strokeOpacity="0.25" />
    ))}
    {/* sprig */}
    <path d="M0 14 C 6 4, 6 -8, 0 -16 C -6 -8, -6 4, 0 14 Z" fill={accent} fillOpacity="0.85" stroke="none" />
    <line x1="0" y1="14" x2="0" y2="-2" stroke={GOLD} strokeOpacity="0.5" />
  </g>
);

/** Strength & Conditioning — a barbell over rising volume bars. */
const TrainingMotif = ({ accent }: { accent: string }) => (
  <g fill="none" strokeLinecap="round">
    {/* rising bars */}
    {[
      { x: 268, h: 26 }, { x: 290, h: 40 }, { x: 312, h: 58 }, { x: 334, h: 78 }, { x: 356, h: 100 },
    ].map((b) => (
      <rect key={b.x} x={b.x} y={132 - b.h} width="12" height={b.h} rx="3" fill={accent} fillOpacity="0.18" stroke={accent} strokeOpacity="0.45" />
    ))}
    {/* barbell */}
    <g transform="translate(330 52)">
      <line x1="-78" y1="0" x2="78" y2="0" stroke={GOLD} strokeOpacity="0.85" strokeWidth="3" />
      {[-70, -58, 58, 70].map((x) => (
        <rect key={x} x={x - 4} y="-16" width="8" height="32" rx="2" fill={accent} fillOpacity="0.9" />
      ))}
      {[-50, -40, 40, 50].map((x) => (
        <rect key={x} x={x - 3} y="-10" width="6" height="20" rx="2" fill={GOLD} fillOpacity="0.6" />
      ))}
    </g>
  </g>
);

/** Recovery & Sleep — crescent moon + calm waves + stars. */
const RecoveryMotif = ({ accent }: { accent: string }) => (
  <g>
    {/* crescent */}
    <g transform="translate(332 56)">
      <circle r="30" fill={accent} fillOpacity="0.9" />
      <circle r="30" cx="13" cy="-7" fill="hsl(258 20% 3.5%)" />
    </g>
    {/* stars */}
    {[{ x: 268, y: 44, r: 1.6 }, { x: 286, y: 70, r: 1.1 }, { x: 380, y: 92, r: 1.3 }].map((s, i) => (
      <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={GOLD} fillOpacity="0.8" />
    ))}
    {/* calm waves */}
    <g fill="none" stroke={accent} strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round">
      <path d="M250 116 q 22 -10 44 0 t 44 0 t 44 0" />
      <path d="M250 130 q 22 -10 44 0 t 44 0 t 44 0" stroke={GOLD} strokeOpacity="0.25" />
    </g>
  </g>
);

/** Mind & Emotional Skill — concentric focus ripples. */
const MindMotif = ({ accent }: { accent: string }) => (
  <g transform="translate(322 78)" fill="none">
    {[58, 46, 34, 22].map((r, i) => (
      <circle key={r} r={r} stroke={i % 2 ? GOLD : accent} strokeOpacity={0.18 + i * 0.14} strokeWidth="1.5" />
    ))}
    <circle r="7" fill={accent} fillOpacity="0.9" />
    <circle r="7" stroke={GOLD} strokeOpacity="0.5" strokeWidth="1" fill="none" />
  </g>
);

/** Nervous System — coherent breathing waveform with a glowing node. */
const NerveMotif = ({ accent }: { accent: string }) => (
  <g fill="none" strokeLinecap="round">
    <path
      d="M232 86 q 18 -42 36 0 t 36 0 q 18 -42 36 0 t 36 0 q 18 -42 36 0"
      stroke={accent}
      strokeOpacity="0.75"
      strokeWidth="2.5"
    />
    <path
      d="M232 104 q 18 -28 36 0 t 36 0 q 18 -28 36 0 t 36 0 q 18 -28 36 0"
      stroke={GOLD}
      strokeOpacity="0.3"
      strokeWidth="1.5"
    />
    <circle cx="340" cy="86" r="4.5" fill={accent} />
    <circle cx="340" cy="86" r="9" stroke={accent} strokeOpacity="0.4" strokeWidth="1.5" />
  </g>
);

/** Inner Work — radiant inner sun rising over a horizon line. */
const InnerWorkMotif = ({ accent }: { accent: string }) => (
  <g fill="none" strokeLinecap="round">
    {/* horizon */}
    <path d="M240 108 h 148" stroke={GOLD} strokeOpacity="0.25" strokeWidth="1.5" />
    {/* rising core */}
    <g transform="translate(314 92)">
      <circle r="16" fill={accent} fillOpacity="0.16" />
      <circle r="9" fill={accent} fillOpacity="0.9" />
      <circle r="13" stroke={GOLD} strokeOpacity="0.5" strokeWidth="1" />
      {/* rays */}
      {[-72, -48, -24, 0, 24, 48, 72].map((deg) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const x1 = Math.cos(rad) * 20, y1 = Math.sin(rad) * 20;
        const x2 = Math.cos(rad) * (deg % 48 === 0 ? 32 : 27), y2 = Math.sin(rad) * (deg % 48 === 0 ? 32 : 27);
        return (
          <path
            key={deg}
            d={`M${x1} ${y1} L${x2} ${y2}`}
            stroke={deg % 48 === 0 ? accent : GOLD}
            strokeOpacity={deg % 48 === 0 ? 0.8 : 0.45}
            strokeWidth="2"
          />
        );
      })}
    </g>
    {/* star field */}
    {[{ x: 254, y: 52, r: 1.5 }, { x: 282, y: 38, r: 1.1 }, { x: 356, y: 40, r: 1.4 }, { x: 378, y: 62, r: 1.0 }].map((s, i) => (
      <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={GOLD} fillOpacity="0.8" />
    ))}
  </g>
);

const MOTIFS: Record<string, (p: { accent: string }) => JSX.Element> = {
  recipes: NutritionMotif,
  training: TrainingMotif,
  recovery: RecoveryMotif,
  mind: MindMotif,
  "nervous-system": NerveMotif,
  "inner-work": InnerWorkMotif,
};

const VaultCover = ({ id, accent }: { id: string; accent: string }) => {
  const Motif = MOTIFS[id] ?? MindMotif;
  return (
    <Frame id={id} accent={accent}>
      <Motif accent={accent} />
    </Frame>
  );
};

export default VaultCover;
