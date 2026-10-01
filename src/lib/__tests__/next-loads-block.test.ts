import { describe, it, expect } from "vitest";
import { buildNextLoadsBlock, type NextLoad } from "../../../supabase/functions/_shared/progression";

const lift = (over: Partial<NextLoad>): NextLoad => ({
  slug: "Barbell_Squat", name: "Barbell Squat", move: "hold", weight: 100, reps: 10, step: 0,
  reason: "Same 100 kg — chase 10 on every set.", last: { on: "2026-09-29", weight: 100, reps: 6 }, prescribed: true, ...over,
});

describe("buildNextLoadsBlock — the rule's numbers as prompt text", () => {
  it("names every lift with its arrow, load, reps and reason, counts the plates and binds the model to them", () => {
    const t = buildNextLoadsBlock([
      lift({ move: "up", weight: 102.5, reps: 6, step: 2.5, reason: "All 3 sets hit 10 at 100 kg — add 2.5 kg, back to 6." }),
      lift({ slug: "Pullups", name: "Pull-up", move: "hold", weight: 25, reps: 8, prescribed: false, reason: "Same as last time: 25 kg." }),
      lift({ slug: "Bench_Press", name: "Bench Press", move: "repeat", weight: 80, reps: 6, reason: "A set fell to 5 — repeat 80 kg and own the 6." }),
    ]);
    expect(t).toContain("NEXT LOADS — BINDING");
    expect(t).toContain("- Barbell Squat: ↑ 102.5 kg × 6 — All 3 sets hit 10 at 100 kg — add 2.5 kg, back to 6.");
    expect(t).toContain("- Pull-up: → 25 kg × 8 — Same as last time: 25 kg. (no program range: the weight holds)");
    expect(t).toContain("- Bench Press: ↻ 80 kg × 6 — A set fell to 5 — repeat 80 kg and own the 6.");
    expect(t).toContain("1 lift earned a plate.");
    expect(t).toMatch(/Do NOT add 2\.5 kg/);
    expect(t).toMatch(/outranks any load named in the morning brief/);
  });
  it("is empty with nothing lifted, and says so when no plate was earned", () => {
    expect(buildNextLoadsBlock([])).toBe("");
    expect(buildNextLoadsBlock([lift({})])).toContain("No lift earned a plate yet");
  });
});
