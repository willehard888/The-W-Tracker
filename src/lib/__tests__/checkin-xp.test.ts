import { describe, it, expect } from "vitest";
import {
  scoreDay,
  maxDayScore,
  sleepCurve,
  sleepClaim,
  effortPerMinute,
  dayScoreFromRow,
  DAY_MAX,
  DAY_MAX_HEALTH,
  TRAINING_CAP,
  type DayScoreInput,
  type DayScoreLine,
} from "@/lib/checkin-xp";
import cases from "@/lib/__fixtures__/day-score-cases.json";

interface Case {
  name: string;
  input: DayScoreInput;
  expected: {
    total: number;
    max: number;
    verified: boolean;
    pts: Record<DayScoreLine["k"], number>;
    src: Partial<Record<"training" | "sleep" | "mind", string>>;
  };
}

const CASES = cases as Case[];
const LINE_ORDER: DayScoreLine["k"][] = ["training", "sleep", "steps", "mind", "hydration", "habits", "perfect"];

// The same file drives scripts/xp-parity.mjs against score_checkin in SQL:
// a case that passes here and fails there is a client/server split.
describe("scoreDay — the fixture contract (mirrors score_checkin)", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const out = scoreDay(c.input);
      const pts = Object.fromEntries(out.lines.map((l) => [l.k, l.pts]));
      expect(pts).toEqual(c.expected.pts);
      expect(out.total).toBe(c.expected.total);
      expect(out.max).toBe(c.expected.max);
      expect(out.verified).toBe(c.expected.verified);
      for (const k of ["training", "sleep", "mind"] as const) {
        const line = out.lines.find((l) => l.k === k)!;
        expect(line.src, `${k} src`).toBe(c.expected.src[k]);
      }
      expect(out.lines.map((l) => l.k)).toEqual(LINE_ORDER);
      expect(out.lines.reduce((s, l) => s + l.pts, 0)).toBe(out.total);
    });
  }

  it("has at least one case per line and both ceilings", () => {
    const totals = CASES.map((c) => c.expected.total);
    expect(totals).toContain(DAY_MAX);
    expect(totals).toContain(DAY_MAX_HEALTH);
    for (const k of LINE_ORDER) {
      expect(CASES.some((c) => c.expected.pts[k] > 0), `a case scores ${k}`).toBe(true);
    }
  });
});

describe("the curves", () => {
  it("sleep: 7–9 h full, linear below, long nights taper", () => {
    expect(sleepCurve(3.9)).toBe(0);
    expect(sleepCurve(4)).toBe(0);
    expect(sleepCurve(5.5)).toBeCloseTo(12.5);
    expect(sleepCurve(7)).toBe(25);
    expect(sleepCurve(9)).toBe(25);
    expect(sleepCurve(9.5)).toBe(20);
    expect(sleepCurve(10.5)).toBe(15);
    expect(sleepCurve(null)).toBe(0);
  });
  it("a claimed night is the curve at 60 %", () => {
    for (const h of [4, 5, 6, 6.5, 7, 8, 9, 9.5, 11]) {
      expect(sleepClaim(h)).toBeCloseTo(0.6 * sleepCurve(h), 9);
    }
  });
  it("effort per minute follows the heart-rate zone; no HR is one", () => {
    const hrMax = 185;
    expect(effortPerMinute(null, hrMax)).toBe(1);
    expect(effortPerMinute(100, hrMax)).toBe(0.5);   // 54 %
    expect(effortPerMinute(120, hrMax)).toBe(1);     // 65 %
    expect(effortPerMinute(140, hrMax)).toBe(1.5);   // 76 %
    expect(effortPerMinute(160, hrMax)).toBe(2);     // 86 %
  });
  it("two hours of zone 4 still stops at the cap", () => {
    const out = scoreDay({
      sleepHours: null, workout: false, hydrationLiters: 0, meditationMorning: false, meditationEvening: false,
      chosenKeys: [], doneKeys: [], appSessionToday: false, age: 30,
      health: { workouts: [{ duration_min: 120, avg_hr: 170, manual: false }], workout_minutes: 120, sleep_hours: null, steps: null, mindful_minutes: null },
    });
    expect(out.lines[0].pts).toBe(TRAINING_CAP);
  });
});

describe("maxDayScore — the honest promise on Home", () => {
  it("is 100, or 150 once Health scores the day", () => {
    expect(maxDayScore([], false)).toBe(DAY_MAX);
    expect(maxDayScore([], true)).toBe(DAY_MAX_HEALTH);
  });
  it("fewer than four habits share less", () => {
    expect(maxDayScore(["cold_shower", "reading"], false)).toBe(100 - 25 + 13);
    expect(maxDayScore(["cold_shower", "reading", "sauna", "creatine"], false)).toBe(100);
  });
  it("is what a perfect day actually scores", () => {
    const perfect = CASES.find((c) => c.expected.total === DAY_MAX)!;
    expect(maxDayScore(perfect.input.chosenKeys, false)).toBe(perfect.expected.total);
  });
});

describe("dayScoreFromRow", () => {
  it("reads a v3 breakdown and rejects older rows", () => {
    expect(dayScoreFromRow(null)).toBeNull();
    expect(dayScoreFromRow({ v: 2, total: 80 })).toBeNull();
    const row = { v: 3, total: 73, max: 150, verified: false, lines: [{ k: "training", pts: 50, max: 50, src: "health" }] };
    expect(dayScoreFromRow(row)).toEqual({ total: 73, max: 150, verified: false, lines: row.lines });
  });
});
