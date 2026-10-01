import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fmtDate, fmtInt, NBSP } from "@/lib/format";
import { localDateKey } from "@/lib/date";
import { hapticSelection } from "@/lib/haptics";
import {
  chartLayout,
  metricFor,
  movementStats,
  nearestPoint,
  progressionSummary,
  valueOf,
  windowPoints,
  type ChartLayout,
  type Metric,
  type SessionPoint,
} from "@/lib/training/progression";
import AnimatedNumber from "@/components/AnimatedNumber";
import { EmptyState } from "@/components/ui/empty-state";
import { fmtKg } from "@/components/coach/session/SetRow";
import { SEGMENT_ACTIVE, SEGMENT_BUTTON, SEGMENT_IDLE, SEGMENT_TRACK } from "@/components/ui/segment";

const MAIN_H = 160;
const SECOND_H = 96;
const PAD: [number, number, number, number] = [12, 12, 22, 34];
const RANGES: Array<{ weeks: number | null; label: string }> = [
  { weeks: 4, label: "4 wk" },
  { weeks: 10, label: "10 wk" },
  { weeks: 25, label: "25 wk" },
  { weeks: 52, label: "52 wk" },
  { weeks: null, label: "All" },
];

const dayLabel = (date: string, today: string) => {
  const diff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : fmtDate(`${date}T12:00:00`);
};

const setLabel = (s: SessionPoint["sets"][number]) =>
  s.weight != null
    ? `${fmtKg(s.weight)} × ${s.reps != null ? fmtInt(s.reps) : "—"}`
    : s.reps != null ? `${fmtInt(s.reps)} reps` : "—";

/** The container's width, so the SVG is drawn at pixel size (text stays crisp, nothing stretches). */
const useWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { const w = el.getBoundingClientRect().width; if (w > 0) setWidth(w); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
};

/**
 * One curve: the sessions' values in `metric` against real dates, a monotone
 * path (a plateau draws flat, a record is the peak), the selected session
 * marked with a hairline and a halo, PR sessions ringed in ember on the main
 * chart. A finger across it scrubs — vertical drags still scroll the sheet
 * (touch-action: pan-y) — and the selection stays where it was left.
 */
const Curve = ({
  points,
  metric,
  height,
  label,
  unit,
  selectedDate,
  onSelect,
  rings,
  drawKey,
}: {
  points: SessionPoint[];
  metric: Metric;
  height: number;
  label: string;
  unit: string;
  selectedDate: string | null;
  onSelect: (date: string) => void;
  rings: boolean;
  drawKey: number;
}) => {
  const { ref, width } = useWidth();
  const layout: ChartLayout = useMemo(() => chartLayout(points, metric, { w: width, h: height, pad: PAD }), [points, metric, width, height]);
  const gradId = useId();
  const reduced = useReducedMotion();
  const scrubbing = useRef(false);
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = nearestPoint(layout.pts, e.clientX - r.left);
    if (p) onSelect(points[p.i].date);
  };
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    scrubbing.current = true;
    // Capture keeps the scrub alive when the finger leaves the SVG; a pointer the
    // browser no longer tracks (a synthetic event) must not end it before pick.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ }
    pick(e);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => { if (scrubbing.current) pick(e); };
  const onUp = () => { scrubbing.current = false; };

  const sel = layout.pts.find((p) => points[p.i].date === selectedDate);
  const first = valueOf(points[0], metric), last = valueOf(points[points.length - 1], metric);
  return (
    <div ref={ref} className="w-full">
      <p className="text-label font-bold text-muted-foreground">{label}</p>
      <svg
        role="img"
        aria-label={`${label}, ${points.length} sessions, ${fmtInt(first ?? 0)} to ${fmtInt(last ?? 0)} ${unit}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block select-none [touch-action:pan-y]"
        data-no-haptic
        data-testid={`curve-${metric}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {layout.yTicks.map((t) => (
          <g key={t.label}>
            <line x1={PAD[3]} x2={width - PAD[1]} y1={t.y} y2={t.y} stroke="hsl(var(--border))" strokeOpacity="0.6" />
            <text x={PAD[3] - 6} y={t.y + 3} textAnchor="end" className="fill-muted-foreground text-label tabular-nums" fillOpacity="0.75">{t.label}</text>
          </g>
        ))}
        {layout.xTicks.map((t, k) => (
          <text
            key={`${t.label}-${k}`}
            x={t.x}
            y={height - 6}
            textAnchor={k === 0 ? "start" : k === layout.xTicks.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground text-label tabular-nums"
            fillOpacity="0.75"
          >
            {t.label}
          </text>
        ))}
        <path d={layout.area} fill={`url(#${gradId})`} />
        <path
          key={drawKey}
          d={layout.line}
          fill="none"
          stroke="hsl(var(--gold))"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className={reduced ? undefined : "chart-draw"}
        />
        {sel && <line x1={sel.x} x2={sel.x} y1={PAD[0]} y2={layout.baseline} stroke="hsl(var(--foreground))" strokeOpacity="0.3" />}
        {layout.pts.map((p) => {
          const s = points[p.i];
          const isSel = s.date === selectedDate;
          const ring = rings && s.isPr;
          return (
            <g key={s.date} data-testid={ring ? "pr-point" : "point"}>
              {isSel && <circle cx={p.x} cy={p.y} r={9} fill="hsl(var(--gold))" fillOpacity="0.18" />}
              {ring && <circle cx={p.x} cy={p.y} r={7} fill="none" stroke="hsl(var(--ember))" strokeWidth={2} />}
              <circle cx={p.x} cy={p.y} r={isSel ? 4.5 : 3.5} fill="hsl(var(--gold))" stroke="hsl(var(--card))" />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="surface-inset rounded-lg px-2 py-1.5 text-center min-w-0">
    <p className="font-display text-subhead font-black tabular-nums leading-tight text-foreground truncate">{value}</p>
    <p className="text-label font-bold uppercase tracking-wide text-muted-foreground/75 truncate">{label}</p>
  </div>
);

/**
 * One movement's progression, after the founder's reference: four all-time
 * tiles (sessions · sets · best · last), a range row, the weight curve, the
 * reps curve, and the selected session's sets as the results. The latest
 * session is selected by default; both curves share the selection.
 */
export const ProgressionChart = ({
  points,
  name,
  today = localDateKey(),
  className,
}: {
  points: SessionPoint[];
  name: string;
  /** YYYY-MM-DD; injectable for tests. */
  today?: string;
  className?: string;
}) => {
  const metric = useMemo(() => metricFor(points), [points]);
  const stats = useMemo(() => movementStats(points, today), [points, today]);
  const [weeks, setWeeks] = useState<number | null>(null);
  const shown = useMemo(() => windowPoints(points, weeks, today), [points, weeks, today]);
  const summary = useMemo(() => progressionSummary(shown, metric), [shown, metric]);

  // The selected session by date, so a range change keeps it while it is still shown.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected = shown.find((p) => p.date === selectedDate) ?? shown[shown.length - 1] ?? null;
  const select = (date: string) => {
    if (date === selected?.date) return;
    setSelectedDate(date);
    hapticSelection();
  };

  // The curves draw themselves in once per range, never on a scrub (the path remounts).
  const [drawKey, setDrawKey] = useState(0);
  const firstDraw = useRef(true);
  useEffect(() => { if (firstDraw.current) { firstDraw.current = false; return; } setDrawKey((k) => k + 1); }, [weeks]);

  if (points.length === 0) return null;
  const curve = shown.filter((p) => valueOf(p, metric) != null).length >= 2;
  const repsCurve = metric === "weight" && shown.filter((p) => p.bestReps != null).length >= 2;
  const headline = selected ? valueOf(selected, metric) : null;
  const unit = metric === "weight" ? "kg" : "reps";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid grid-cols-4 gap-1.5" aria-label={`${name} all time`}>
        <Stat value={fmtInt(stats.sessions)} label={stats.sessions === 1 ? "session" : "sessions"} />
        <Stat value={fmtInt(stats.sets)} label="sets" />
        <Stat value={stats.bestWeight != null ? fmtKg(stats.bestWeight) : stats.bestE1rm == null && points.some((p) => p.bestReps != null) ? `${fmtInt(Math.max(...points.map((p) => p.bestReps ?? 0)))} reps` : "—"} label="best" />
        <Stat value={stats.daysSince == null ? "—" : stats.daysSince === 0 ? "today" : `${fmtInt(stats.daysSince)} d`} label="last" />
      </div>

      <div className={SEGMENT_TRACK} role="tablist" aria-label="Range">
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            role="tab"
            aria-selected={weeks === r.weeks}
            className={cn(SEGMENT_BUTTON, "px-0", weeks === r.weeks ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
            onClick={() => setWeeks(r.weeks)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Readout — fixed height so a scrub never moves the chart under the finger. */}
      <div className="flex items-end justify-between gap-3 min-h-[48px]" aria-live="polite">
        <div className="min-w-0">
          <p className="text-meta font-bold text-foreground">{selected ? dayLabel(selected.date, today) : ""}</p>
          {selected && (
            <p className="text-label text-muted-foreground tabular-nums truncate">
              Top {setLabel(selected.top)} · {selected.sets.length} {selected.sets.length === 1 ? "set" : "sets"}
              {selected.volume > 0 ? ` · ${fmtInt(selected.volume)}${NBSP}kg` : ""}
              {selected.isPr ? " · PR" : ""}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-display text-major font-black tabular-nums leading-display text-gold glow-gold-text">
            {headline != null ? <AnimatedNumber value={headline} duration={350} format={(n) => fmtInt(Math.round(n))} /> : "—"}
          </p>
          <p className="text-label text-muted-foreground">{metric === "weight" ? "top set, kg" : "best reps"}</p>
        </div>
      </div>

      {curve ? (
        <>
          <Curve points={shown} metric={metric} height={MAIN_H} label={metric === "weight" ? "Weight (kg)" : "Reps"} unit={unit} selectedDate={selected?.date ?? null} onSelect={select} rings drawKey={drawKey} />
          {repsCurve && (
            <Curve points={shown} metric="reps" height={SECOND_H} label="Reps per set (best)" unit="reps" selectedDate={selected?.date ?? null} onSelect={select} rings={false} drawKey={drawKey} />
          )}
        </>
      ) : (
        <EmptyState size="compact" title={shown.length < points.length ? "No second session in this range" : "Lock one more session to see the curve"} />
      )}

      {selected && (
        <ul className="divide-y divide-border/35 border-t border-border/35" aria-label={`Sets on ${dayLabel(selected.date, today)}`}>
          {selected.sets.map((s) => (
            <li key={s.set_index} className="flex items-center justify-between py-1.5 text-dense tabular-nums">
              <span className="text-muted-foreground">Set {s.set_index}</span>
              <span className="font-bold text-foreground">
                {setLabel(s)}
                {s.rpe != null && <span className="font-semibold text-muted-foreground/75"> · RPE {s.rpe}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-label text-muted-foreground tabular-nums">
        {summary.sessions} {summary.sessions === 1 ? "session" : "sessions"} in range
        {summary.delta !== 0 && (
          <span className={summary.delta > 0 ? "text-xp-green" : "text-destructive"}> · {summary.delta > 0 ? "+" : "−"}{Math.abs(summary.delta)}{NBSP}{unit}</span>
        )}
        {stats.bestE1rm != null && ` · best est. 1RM ${fmtInt(Math.round(stats.bestE1rm))}${NBSP}kg`}
      </p>
    </div>
  );
};

export default ProgressionChart;
