import { describe, expect, it } from "vitest";
import { programWeekState as client } from "@/lib/training/program-week";
import { programWeekState as edge } from "../../../../supabase/functions/_shared/program-week";

/**
 * The edge functions (coach-daily-plan, ai-coach, coach-daily-brief) carry a
 * copy of the week derivation because Supabase bundles each function from its
 * own folder. If the copies drift, the runner and the daily plan disagree
 * about which week the athlete is in — the exact bug the shared formula fixed.
 */
const now = new Date(2026, 8, 6, 12, 0, 0);
const cases = [
  { startedOn: "2026-08-10", weeks: 4, logs: [] },
  { startedOn: "2026-08-24", weeks: 4, logs: [{ week: 1, completed: true }, { week: 1, completed: false }] },
  { startedOn: "2026-07-01", weeks: 4, logs: [{ week: 1, completed: true }, { week: 2, completed: true }] },
  { startedOn: "2026-09-05", weeks: 6, logs: [{ week: 6, completed: true }] },
  { startedOn: null, weeks: null, logs: null },
];

describe("program-week: edge copy matches the client", () => {
  it.each(cases)("%o", (c) => {
    expect(edge({ ...c, now })).toEqual(client({ ...c, now }));
  });
});
