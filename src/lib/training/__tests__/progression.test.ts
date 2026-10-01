import { describe, it, expect } from "vitest";
import {
  chartLayout,
  metricFor,
  monotonePath,
  movementStats,
  nearestPoint,
  niceStep,
  progressionSummary,
  sessionsFor,
  valueOf,
  windowPoints,
} from "@/lib/training/progression";

const row = (logged_on: string, set_index: number, weight: number | null, reps: number | null, rpe: number | null = 8) =>
  ({ logged_on, set_index, weight, reps, rpe });

const squat = [
  row("2026-09-01", 2, 100, 5), row("2026-09-01", 1, 100, 5), row("2026-09-01", 3, 100, 4),
  row("2026-09-08", 1, 102.5, 5), row("2026-09-08", 2, 102.5, 5),
  row("2026-09-15", 1, 102.5, 6), row("2026-09-15", 2, 102.5, 5),
  row("2026-09-22", 1, 105, 5), row("2026-09-22", 2, 105, 5),
  row("2026-09-29", 1, 100, 8), row("2026-09-29", 2, 100, 8),
];

describe("sessionsFor", () => {
  it("groups rows into sessions oldest first, sets ordered by index, with the top set, e1RM, volume", () => {
    const s = sessionsFor(squat);
    expect(s.map((p) => p.date)).toEqual(["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"]);
    expect(s[0].sets.map((x) => x.set_index)).toEqual([1, 2, 3]);
    expect(s[0].top).toMatchObject({ weight: 100, reps: 5 }); // heaviest, then most reps at that weight
    expect(s[0].e1rm).toBeCloseTo(100 * (1 + 5 / 30), 5);
    expect(s[0].volume).toBe(1400);
    expect(s[2].top).toMatchObject({ weight: 102.5, reps: 6 });
  });

  it("marks a weight PR when the top set beats every earlier session — the first is a baseline, a tie is not", () => {
    const s = sessionsFor(squat);
    expect(s.map((p) => p.isPr)).toEqual([false, true, false, true, false]);
  });

  it("handles bodyweight rows (no weight): e1RM null, reps kept, volume 0", () => {
    const s = sessionsFor([row("2026-09-01", 1, null, 8), row("2026-09-01", 2, null, 6)]);
    expect(s[0]).toMatchObject({ e1rm: null, bestReps: 8, volume: 0, isPr: false });
    expect(s[0].top.reps).toBe(8);
  });

  it("ignores rows without a day and tolerates missing set_index", () => {
    const s = sessionsFor([{ logged_on: "", weight: 1, reps: 1 }, { logged_on: "2026-09-01", weight: 50, reps: 10 }]);
    expect(s).toHaveLength(1);
    expect(s[0].sets[0].set_index).toBe(1);
  });
});

describe("metricFor / valueOf / windowPoints / summary / stats", () => {
  const s = sessionsFor(squat);
  it("charts weight when any session was loaded, reps otherwise", () => {
    expect(metricFor(s)).toBe("weight");
    expect(metricFor(sessionsFor([row("2026-09-01", 1, null, 8)]))).toBe("reps");
    expect(valueOf(s[3], "weight")).toBe(105);
    expect(valueOf(s[4], "reps")).toBe(8);
  });

  it("windows by calendar weeks from today, all when null", () => {
    expect(windowPoints(s, 2, "2026-09-30").map((p) => p.date)).toEqual(["2026-09-22", "2026-09-29"]);
    expect(windowPoints(s, null, "2026-09-30")).toHaveLength(5);
  });

  it("summarises the window: latest, best, delta first→last", () => {
    const sum = progressionSummary(s, "weight");
    expect(sum.latest?.date).toBe("2026-09-29");
    expect(sum.best?.date).toBe("2026-09-22");
    expect(sum.delta).toBe(0); // 100 → 100
    expect(progressionSummary(s.slice(0, 4), "weight").delta).toBe(5);
    expect(progressionSummary([], "weight")).toMatchObject({ latest: null, best: null, delta: 0, sessions: 0 });
  });

  it("all-time stats: sessions, sets, best weight, best e1RM, days since", () => {
    const st = movementStats(s, "2026-10-01");
    expect(st).toMatchObject({ sessions: 5, sets: 11, bestWeight: 105, daysSince: 2 });
    expect(st.bestE1rm).toBeCloseTo(100 * (1 + 8 / 30), 5); // 8 reps at 100 beats 5 at 105
    expect(movementStats([], "2026-10-01")).toMatchObject({ sessions: 0, sets: 0, bestWeight: null, daysSince: null });
  });
});

describe("geometry", () => {
  const s = sessionsFor(squat);
  const box = { w: 320, h: 160, pad: [12, 12, 22, 34] as [number, number, number, number] };

  it("places sessions by real date and never lets the curve overshoot the data", () => {
    const l = chartLayout(s, "weight", box);
    expect(l.pts).toHaveLength(5);
    expect(l.pts[0].x).toBe(34);
    expect(l.pts[4].x).toBe(308);
    // Equal weekly spacing → equal x steps.
    const steps = l.pts.slice(1).map((p, i) => p.x - l.pts[i].x);
    for (const d of steps) expect(d).toBeCloseTo(steps[0], 5);
    // Every control point stays inside the data's y-range (monotone cubic).
    const ys = l.pts.map((p) => p.y);
    const lo = Math.min(...ys), hi = Math.max(...ys);
    const coords = l.line.match(/-?\d+(?:\.\d+)?,(-?\d+(?:\.\d+)?)/g)!.map((c) => Number(c.split(",")[1]));
    for (const y of coords) { expect(y).toBeGreaterThanOrEqual(lo - 0.05); expect(y).toBeLessThanOrEqual(hi + 0.05); }
    expect(l.area.endsWith("Z")).toBe(true);
  });

  it("a gap in the calendar is a gap on the axis", () => {
    const gapped = sessionsFor([row("2026-01-01", 1, 100, 5), row("2026-01-08", 1, 100, 5), row("2026-03-01", 1, 100, 5)]);
    const l = chartLayout(gapped, "weight", box);
    expect(l.pts[1].x - l.pts[0].x).toBeLessThan((l.pts[2].x - l.pts[1].x) / 4);
  });

  it("nice y ticks bracket the data, dates label first and last (and the middle over six weeks)", () => {
    const l = chartLayout(s, "weight", box);
    const labels = l.yTicks.map((t) => Number(t.label));
    expect(Math.min(...labels)).toBeLessThanOrEqual(100);
    expect(Math.max(...labels)).toBeGreaterThanOrEqual(105);
    expect(l.yTicks.length).toBeGreaterThanOrEqual(2);
    expect(l.yTicks.length).toBeLessThanOrEqual(5);
    expect(l.xTicks.map((t) => t.label)).toEqual(["Sep 1", "Sep 29"]);
    const long = sessionsFor([row("2026-01-01", 1, 100, 5), row("2026-02-15", 1, 100, 5), row("2026-04-01", 1, 100, 5)]);
    expect(chartLayout(long, "weight", box).xTicks).toHaveLength(3);
  });

  it("one session sits in the middle with no line; none gives an empty layout", () => {
    const one = chartLayout(s.slice(0, 1), "weight", box);
    expect(one.pts[0].x).toBeCloseTo(34 + (320 - 34 - 12) / 2, 5);
    expect(one.line).toBe("");
    expect(chartLayout([], "weight", box).pts).toEqual([]);
  });

  it("niceStep gives round steps; monotonePath handles 0, 1, 2 points", () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(10)).toBe(5);
    expect(niceStep(30)).toBe(10);
    expect(niceStep(100)).toBe(50);
    expect(monotonePath([])).toBe("");
    expect(monotonePath([{ x: 1, y: 2 }])).toBe("M1.0,2.0");
    expect(monotonePath([{ x: 0, y: 0 }, { x: 10, y: 10 }])).toMatch(/^M0\.0,0\.0 C/);
  });

  it("nearestPoint picks by x", () => {
    const l = chartLayout(s, "weight", box);
    expect(nearestPoint(l.pts, 40)?.i).toBe(0);
    expect(nearestPoint(l.pts, 300)?.i).toBe(4);
    expect(nearestPoint([], 10)).toBeNull();
  });
});
