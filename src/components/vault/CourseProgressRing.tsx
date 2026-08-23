const CourseProgressRing = ({
  done,
  total,
  color,
  size = 44,
  stroke = 4,
}: {
  done: number;
  total: number;
  color: string;
  size?: number;
  stroke?: number;
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const offset = c * (1 - pct);
  const complete = total > 0 && done >= total;

  return (
    <div
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`${done} of ${total} lessons complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="hsl(var(--border))"
          strokeOpacity={0.4}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          fill="none"
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {complete ? (
          <span
            className="text-[10px] font-black tracking-tight"
            style={{ color }}
          >
            ✓
          </span>
        ) : (
          <span className="text-[9px] font-black tabular-nums text-foreground/85">
            {done}/{total}
          </span>
        )}
      </div>
    </div>
  );
};

export default CourseProgressRing;
