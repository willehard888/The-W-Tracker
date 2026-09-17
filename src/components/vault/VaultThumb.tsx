/**
 * The Vault's mark at 40 px: a vault door. A machined gold ring on its hinges,
 * a dark face, a five-spoke wheel, one gloss crescent. Drawn for this size in
 * the app's own glossy-vector language (the sun it replaces read as a weather
 * icon and said nothing about a vault). Static on purpose: Home's one moving
 * thing is the check-in. Its own file keeps VaultCover out of the entry chunk.
 */
const CX = 20.5;
const CY = 20;
const at = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)] as const;
};
const RIVETS = [22, 67, 112, 157, 202, 247, 292, 337].map((d) => at(13.6, d));
const SPOKES = [-90, -18, 54, 126, 198].map((d) => [...at(2.4, d), ...at(6.9, d)] as const);
const arc = (r: number, from: number, to: number) => {
  const [x1, y1] = at(r, from);
  const [x2, y2] = at(r, to);
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const VaultThumb = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 40 40" className={className} aria-hidden>
    <defs>
      <linearGradient id="vt-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="hsl(258 20% 10%)" />
        <stop offset="100%" stopColor="hsl(258 16% 4%)" />
      </linearGradient>
      <radialGradient id="vt-halo" cx="51%" cy="50%" r="55%">
        <stop offset="58%" stopColor="hsl(var(--gold))" stopOpacity="0" />
        <stop offset="80%" stopColor="hsl(var(--gold))" stopOpacity="0.2" />
        <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity="0" />
      </radialGradient>
      {/* userSpaceOnUse: a vertical spoke has no box for a gradient to fill. */}
      <linearGradient id="vt-metal" gradientUnits="userSpaceOnUse" x1="8" y1="5" x2="33" y2="36">
        <stop offset="0%" stopColor="hsl(46 95% 86%)" />
        <stop offset="40%" stopColor="hsl(var(--gold))" />
        <stop offset="100%" stopColor="hsl(var(--gold-dark))" />
      </linearGradient>
      <radialGradient id="vt-face" cx="38%" cy="30%" r="80%">
        <stop offset="0%" stopColor="hsl(258 22% 18%)" />
        <stop offset="100%" stopColor="hsl(258 18% 6%)" />
      </radialGradient>
      <radialGradient id="vt-hub" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="hsl(46 95% 86%)" />
        <stop offset="55%" stopColor="hsl(var(--gold))" />
        <stop offset="100%" stopColor="hsl(var(--gold-dark))" />
      </radialGradient>
    </defs>
    <rect width="40" height="40" fill="url(#vt-bg)" />
    <rect width="40" height="40" fill="url(#vt-halo)" />
    {/* hinges: the door hangs on the left */}
    <rect x="3.2" y="11.6" width="5" height="4.2" rx="1.1" fill="url(#vt-metal)" />
    <rect x="3.2" y="24.2" width="5" height="4.2" rx="1.1" fill="url(#vt-metal)" />
    {/* the door: a machined ring, a dark face, a fine groove */}
    <circle cx={CX} cy={CY} r="13.6" fill="none" stroke="url(#vt-metal)" strokeWidth="3.3" />
    <circle cx={CX} cy={CY} r="11.95" fill="url(#vt-face)" stroke="hsl(258 20% 3%)" strokeWidth="0.6" />
    <circle cx={CX} cy={CY} r="10" fill="none" stroke="hsl(var(--gold))" strokeOpacity="0.22" strokeWidth="0.45" />
    {RIVETS.map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="0.6" fill="hsl(258 20% 5%)" fillOpacity="0.6" />
    ))}
    {/* the wheel: five spokes into a rim */}
    <g stroke="url(#vt-metal)" strokeWidth="1.25" strokeLinecap="round">
      {SPOKES.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
    </g>
    <circle cx={CX} cy={CY} r="7.2" fill="none" stroke="url(#vt-metal)" strokeWidth="1.5" />
    <circle cx={CX} cy={CY} r="3.1" fill="url(#vt-hub)" />
    <circle cx={CX} cy={CY} r="1.05" fill="hsl(258 20% 7%)" />
    {/* gloss: a crescent riding the ring, a glint on the hub */}
    <path d={arc(14.3, -160, -105)} fill="none" stroke="white" strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round" />
    <path d={arc(2.2, -165, -100)} fill="none" stroke="white" strokeOpacity="0.75" strokeWidth="0.5" strokeLinecap="round" />
  </svg>
);

export default VaultThumb;
