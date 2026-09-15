/**
 * The Vault's mark at 40 px — the Inner-Work sun in the covers' own language
 * (obsidian ground, engraved grid, a gold floor glow, a hairline frame), drawn
 * for this size instead of cropping a 420×168 cover down to nothing. Its own
 * file keeps VaultCover out of the entry chunk.
 */
const VaultThumb = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden>
    <defs>
      <linearGradient id="vt-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="hsl(258 18% 9%)" />
        <stop offset="100%" stopColor="hsl(258 16% 4%)" />
      </linearGradient>
      <radialGradient id="vt-floor" cx="50%" cy="100%" r="70%">
        <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity="0.38" />
        <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="vt-core" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="hsl(46 95% 82%)" />
        <stop offset="100%" stopColor="hsl(var(--gold))" />
      </radialGradient>
    </defs>
    <rect width="40" height="40" fill="url(#vt-bg)" />
    {/* engraved grid */}
    <g stroke="hsl(var(--gold))" strokeOpacity="0.09" strokeWidth="0.5">
      {[8, 16, 24, 32].map((v) => (
        <g key={v}>
          <line x1={v} y1="0" x2={v} y2="40" />
          <line x1="0" y1={v} x2="40" y2={v} />
        </g>
      ))}
    </g>
    <rect width="40" height="40" fill="url(#vt-floor)" />
    {/* horizon */}
    <line x1="6" y1="29.5" x2="34" y2="29.5" stroke="hsl(var(--gold))" strokeOpacity="0.45" strokeWidth="0.75" />
    {/* rays */}
    <g stroke="hsl(var(--gold))" strokeWidth="1.5" strokeLinecap="round">
      {[-150, -120, -90, -60, -30].map((deg) => {
        const a = (deg * Math.PI) / 180;
        return <line key={deg} x1={20 + 9 * Math.cos(a)} y1={23 + 9 * Math.sin(a)} x2={20 + 14 * Math.cos(a)} y2={23 + 14 * Math.sin(a)} />;
      })}
    </g>
    {/* the sun: a disc with a lit core, sitting on the horizon */}
    <circle cx="20" cy="23" r="6" fill="url(#vt-core)" />
    <rect x="0.5" y="0.5" width="39" height="39" rx="6" fill="none" stroke="hsl(var(--gold))" strokeOpacity="0.35" />
  </svg>
);

export default VaultThumb;
