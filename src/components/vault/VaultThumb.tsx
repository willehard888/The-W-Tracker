/**
 * The Vault's mark at 40 px: a cut gem. Six facets in three golds on the
 * obsidian ground, a soft halo behind it, one glint on the table. Simple on
 * purpose: the founder picked it over a vault door (too much detail for this
 * size) and the original sun (read as a weather icon). Static, so Home keeps
 * one moving thing. Its own file keeps VaultCover out of the entry chunk.
 */
const GOLD = "hsl(var(--gold))";
const LIGHT = "hsl(var(--gold-light))";
const DARK = "hsl(var(--gold-dark))";
const SHINE = "hsl(46 95% 86%)";

const VaultThumb = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden>
    <defs>
      <linearGradient id="vt-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="hsl(258 20% 10%)" />
        <stop offset="100%" stopColor="hsl(258 16% 4%)" />
      </linearGradient>
      <radialGradient id="vt-halo" cx="50%" cy="52%" r="46%">
        <stop offset="0%" stopColor={GOLD} stopOpacity="0.36" />
        <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect width="40" height="40" fill="url(#vt-bg)" />
    <rect width="40" height="40" fill="url(#vt-halo)" />
    {/* Drawn on a 24-unit gem, then grown about its centre to fill the tile. */}
    <g transform="translate(20 21.5) scale(1.16) translate(-20 -21.5)">
    {/* crown: left, table, right */}
    <polygon points="12,11.5 8,18 16,18" fill={GOLD} />
    <polygon points="12,11.5 28,11.5 24,18 16,18" fill={SHINE} />
    <polygon points="28,11.5 32,18 24,18" fill={DARK} />
    {/* pavilion: left, centre, right */}
    <polygon points="8,18 16,18 20,32" fill={GOLD} fillOpacity="0.82" />
    <polygon points="16,18 24,18 20,32" fill={LIGHT} />
    <polygon points="24,18 32,18 20,32" fill={DARK} fillOpacity="0.8" />
    {/* one glint where the light lands */}
    <path d="M13.6 8 L14.2 9.9 L16.1 10.5 L14.2 11.1 L13.6 13 L13 11.1 L11.1 10.5 L13 9.9 Z" fill="white" fillOpacity="0.9" />
    </g>
  </svg>
);

export default VaultThumb;
