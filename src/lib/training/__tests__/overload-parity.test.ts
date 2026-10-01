import { describe, expect, it } from "vitest";
import { loadAdvice as client, parseRange as clientRange } from "@/lib/training/overload";
import { loadAdvice as edge, parseRange as edgeRange } from "../../../../supabase/functions/_shared/overload";

/**
 * The edge functions (coach-weekly-review, ai-coach) carry a copy of the
 * overload rule because Supabase bundles each function from its own folder.
 * If the copies drift, the coach prescribes a load the set row never seeds —
 * the one number the athlete is told twice must be the same number.
 */
const set = (logged_on: string, weight: number | null, reps: number | null, rpe: number | null = 8) => ({ logged_on, weight, reps, rpe });
const cases: Array<{ history: ReturnType<typeof set>[]; reps: string | number | null; rpe?: number | null }> = [
  { history: [set("2026-09-29", 100, 10), set("2026-09-29", 100, 10), set("2026-09-29", 100, 10)], reps: "6-10", rpe: 8 },
  { history: [set("2026-09-29", 100, 10), set("2026-09-29", 100, 8), set("2026-09-29", 100, 7)], reps: "6-10", rpe: 8 },
  { history: [set("2026-09-29", 100, 10), set("2026-09-29", 100, 5)], reps: "6-10", rpe: 8 },
  { history: [set("2026-09-29", 100, 10, 9.5), set("2026-09-29", 100, 10, 9.5)], reps: "6-10", rpe: 8 },
  { history: [set("2026-09-30", null, 12), set("2026-09-29", 100, 10), set("2026-09-22", 95, 6)], reps: "6-10" },
  { history: [set("2026-09-29", 100, 15)], reps: "AMRAP" },
  { history: [], reps: "6-10" },
  { history: [set("2026-09-29", 17.5, 12)], reps: "8-12" },
];

describe("overload: edge copy matches the client", () => {
  it.each(cases)("%o", (c) => {
    expect(edge(c.history, c.reps, c.rpe)).toEqual(client(c.history, c.reps, c.rpe));
  });
  it("parses ranges the same way", () => {
    for (const r of ["6-10", "8 – 12", 5, "10-6", "AMRAP", null]) expect(edgeRange(r)).toEqual(clientRange(r));
  });
});
