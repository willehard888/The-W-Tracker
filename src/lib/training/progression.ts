/**
 * One movement over time — the pure half of the progression chart.
 *
 * Sets arrive as workout_set_logs rows (one per set); the chart wants
 * sessions: a day of this movement with its sets, its top set, its estimated
 * 1RM and its volume. The main curve plots the top set's weight per session
 * (the founder's reference: "Paino (kg)"), a second one the best reps; a
 * movement never loaded (pull-ups, dips) charts reps alone. Dates are real: a
 * three-week gap is a gap on the x-axis, not the next tick.
 */
import { e1rm } from "@/lib/training/runner";

export interface SetResult {
  set_index: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
}

export interface SessionPoint {
  /** YYYY-MM-DD, the row's logged_on. */
  date: string;
  sets: SetResult[];
  /** The heaviest set, then the most reps at that weight. */
  top: SetResult;
  /** Best Epley estimate over the loaded sets; null when no set carried a weight. */
  e1rm: number | null;
  /** The most reps in one set. */
  bestReps: number | null;
  /** Σ weight × reps over the loaded sets. */
  volume: number;
  /** The top set's weight beats every earlier session's. The first is a baseline; a tie is not a record. */
  isPr: boolean;
}

export type Metric = "weight" | "reps";

interface SetRowLike {
  logged_on: string;
  set_index?: number | null;
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
}

const num = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Rows → sessions, oldest first. Rows may arrive in any order. */
export function sessionsFor(rows: SetRowLike[]): SessionPoint[] {
  const byDay = new Map<string, SetResult[]>();
  for (const r of rows) {
    const day = (r.logged_on ?? "").slice(0, 10);
    if (!day) continue;
    const list = byDay.get(day) ?? [];
    list.push({ set_index: r.set_index ?? 1, weight: num(r.weight), reps: num(r.reps), rpe: num(r.rpe) });
    byDay.set(day, list);
  }
  const out: SessionPoint[] = [];
  let best = -Infinity;
  for (const date of [...byDay.keys()].sort()) {
    const sets = byDay.get(date)!.sort((a, b) => a.set_index - b.set_index);
    const top = sets.reduce((t, s) => {
      const tw = t.weight ?? -1, sw = s.weight ?? -1;
      if (sw > tw) return s;
      if (sw === tw && (s.reps ?? -1) > (t.reps ?? -1)) return s;
      return t;
    }, sets[0]);
    let est: number | null = null;
    let volume = 0;
    let bestReps: number | null = null;
    for (const s of sets) {
      if (s.reps != null) bestReps = Math.max(bestReps ?? -Infinity, s.reps);
      if (s.weight == null) continue;
      est = Math.max(est ?? -Infinity, e1rm(s.weight, s.reps ?? 1));
      volume += s.weight * (s.reps ?? 1);
    }
    const isPr = top.weight != null && Number.isFinite(best) && top.weight > best;
    if (top.weight != null) best = Math.max(best, top.weight);
    out.push({ date, sets, top, e1rm: est, bestReps, volume: Math.round(volume), isPr });
  }
  return out;
}

/** Weight when any session carried a load; reps for a movement never loaded. */
export const metricFor = (points: SessionPoint[]): Metric => (points.some((p) => p.top.weight != null) ? "weight" : "reps");

/** The value a session contributes to a curve: the top set's weight, or the best reps. */
export const valueOf = (p: SessionPoint, metric: Metric): number | null => (metric === "weight" ? p.top.weight : p.bestReps);

export interface MovementStats {
  sessions: number;
  sets: number;
  /** Heaviest top set ever, kg; null for a movement never loaded. */
  bestWeight: number | null;
  /** Best estimated 1RM ever, kg. */
  bestE1rm: number | null;
  /** Whole days since the last session. */
  daysSince: number | null;
}

/** All-time numbers for the tile row: sessions · sets · best · last. */
export function movementStats(points: SessionPoint[], today: string): MovementStats {
  let sets = 0, bestWeight: number | null = null, bestE1rm: number | null = null;
  for (const p of points) {
    sets += p.sets.length;
    if (p.top.weight != null) bestWeight = Math.max(bestWeight ?? -Infinity, p.top.weight);
    if (p.e1rm != null) bestE1rm = Math.max(bestE1rm ?? -Infinity, p.e1rm);
  }
  const last = points[points.length - 1];
  const daysSince = last ? Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last.date}T00:00:00Z`)) / 86_400_000)) : null;
  return { sessions: points.length, sets, bestWeight, bestE1rm, daysSince };
}

/** The sessions inside the last `weeks` weeks (all when null), by calendar date. */
export function windowPoints(points: SessionPoint[], weeks: number | null, today: string): SessionPoint[] {
  if (weeks == null) return points;
  const t = Date.parse(`${today}T00:00:00Z`);
  const since = new Date(t - weeks * 7 * 86_400_000).toISOString().slice(0, 10);
  return points.filter((p) => p.date >= since);
}

export interface ProgressionSummary {
  latest: SessionPoint | null;
  /** The session holding the best value of the metric. */
  best: SessionPoint | null;
  /** Last minus first inside the window, in the metric's unit; 0 with fewer than two values. */
  delta: number;
  sessions: number;
}

export function progressionSummary(points: SessionPoint[], metric: Metric): ProgressionSummary {
  const valued = points.filter((p) => valueOf(p, metric) != null);
  const latest = points[points.length - 1] ?? null;
  let best: SessionPoint | null = null;
  for (const p of valued) if (!best || (valueOf(p, metric) as number) > (valueOf(best, metric) as number)) best = p;
  const delta = valued.length >= 2 ? (valueOf(valued[valued.length - 1], metric) as number) - (valueOf(valued[0], metric) as number) : 0;
  return { latest, best, delta: Math.round(delta * 10) / 10, sessions: points.length };
}

// ---------- geometry ----------

export interface ChartPoint {
  x: number;
  y: number;
  /** Index into the `points` array the layout was built from. */
  i: number;
}

export interface ChartLayout {
  pts: ChartPoint[];
  /** SVG path of the curve (empty with fewer than two points). */
  line: string;
  /** The curve closed down to the baseline, for the fill. */
  area: string;
  yTicks: Array<{ y: number; label: string }>;
  xTicks: Array<{ x: number; label: string }>;
  /** The y of the plot's bottom edge. */
  baseline: number;
}

export interface ChartBox {
  w: number;
  h: number;
  /** Inner padding: top, right, bottom, left. */
  pad: [number, number, number, number];
}

const DAY = 86_400_000;
const dayNum = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;

/** A round step that gives 2–4 gridlines over the range. */
export function niceStep(range: number): number {
  if (range <= 0) return 1;
  const raw = range / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw) return m * mag;
  return 10 * mag;
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson): the curve passes through
 * every session and never overshoots one — a plateau draws flat, a PR is the
 * peak, not a bump past it.
 */
export function monotonePath(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  const dx: number[] = [], dy: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    dy.push(pts[i + 1].y - pts[i].y);
    m.push(dx[i] === 0 ? 0 : dy[i] / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i].x + h).toFixed(1)},${(pts[i].y + t[i] * h).toFixed(1)} ${(pts[i + 1].x - h).toFixed(1)},${(pts[i + 1].y - t[i + 1] * h).toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
  }
  return d;
}

const shortDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Sessions → pixel geometry inside `box`. Sessions without a value in the metric are skipped. */
export function chartLayout(points: SessionPoint[], metric: Metric, box: ChartBox): ChartLayout {
  const [pt, pr, pb, pl] = box.pad;
  const innerW = Math.max(1, box.w - pl - pr);
  const innerH = Math.max(1, box.h - pt - pb);
  const baseline = pt + innerH;
  const valued = points.map((p, i) => ({ p, i, v: valueOf(p, metric) })).filter((e): e is { p: SessionPoint; i: number; v: number } => e.v != null);
  if (valued.length === 0) return { pts: [], line: "", area: "", yTicks: [], xTicks: [], baseline };

  const vals = valued.map((e) => e.v);
  const vMin = Math.min(...vals), vMax = Math.max(...vals);
  const step = niceStep(Math.max(vMax - vMin, metric === "weight" ? 10 : 2));
  const yLo = Math.floor(vMin / step) * step;
  const yHi = Math.max(Math.ceil(vMax / step) * step, yLo + step);
  const y = (v: number) => baseline - ((v - yLo) / (yHi - yLo)) * innerH;

  const d0 = dayNum(valued[0].p.date), d1 = dayNum(valued[valued.length - 1].p.date);
  const span = Math.max(d1 - d0, 1);
  const x = (date: string) => (valued.length === 1 ? pl + innerW / 2 : pl + ((dayNum(date) - d0) / span) * innerW);

  const pts = valued.map((e) => ({ x: x(e.p.date), y: y(e.v), i: e.i }));
  const line = pts.length >= 2 ? monotonePath(pts) : "";
  const area = line ? `${line} L${pts[pts.length - 1].x.toFixed(1)},${baseline.toFixed(1)} L${pts[0].x.toFixed(1)},${baseline.toFixed(1)} Z` : "";

  const yTicks: ChartLayout["yTicks"] = [];
  for (let v = yLo; v <= yHi + 1e-9; v += step) yTicks.push({ y: y(v), label: `${Math.round(v)}` });

  const xTicks: ChartLayout["xTicks"] = [{ x: pts[0].x, label: shortDate(valued[0].p.date) }];
  if (valued.length > 1) {
    if (span >= 42) {
      const mid = valued[Math.floor(valued.length / 2)];
      xTicks.push({ x: x(mid.p.date), label: shortDate(mid.p.date) });
    }
    xTicks.push({ x: pts[pts.length - 1].x, label: shortDate(valued[valued.length - 1].p.date) });
  }
  return { pts, line, area, yTicks, xTicks, baseline };
}

/** The point nearest an x — what a finger on the chart selects. */
export function nearestPoint(pts: ChartPoint[], x: number): ChartPoint | null {
  let best: ChartPoint | null = null;
  for (const p of pts) if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
  return best;
}
