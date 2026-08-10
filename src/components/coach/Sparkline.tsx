import { useId } from "react";

interface Props {
  /** Values in chronological order (oldest → newest). */
  values: number[];
  className?: string;
}

/**
 * Tiny dependency-free SVG sparkline for exercise weight progression. Uses a
 * fixed viewBox and scales to its container width, so it stays crisp without
 * pulling a charting library into the lazy exercise chunk.
 */
const Sparkline = ({ values, className }: Props) => {
  // Unique gradient id per instance — a hardcoded id collides when several
  // sparklines render on one page (url(#…) resolves to the FIRST match, so a
  // future variant color would silently render as the other chart's gradient).
  const gradId = useId();
  if (values.length < 2) return null;
  const W = 100;
  const H = 32;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = W / (values.length - 1);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const lastX = (values.length - 1) * stepX;
  const lastY = y(values[values.length - 1]);
  // Soft gradient fill under the line.
  const area = `0,${H} ${pts} ${lastX.toFixed(2)},${H}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline
        points={pts}
        fill="none"
        stroke="hsl(var(--gold))"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={2.6} fill="hsl(var(--gold))" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export default Sparkline;
