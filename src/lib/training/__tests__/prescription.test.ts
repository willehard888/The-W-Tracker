import { describe, it, expect } from "vitest";
import { prescriptionLabel, prescriptionGloss, repsLabel } from "@/lib/training/prescription";

describe("prescriptionLabel — the dose as one line", () => {
  it("reads sets × reps · RPE, ranges with an en dash", () => {
    expect(prescriptionLabel({ sets: 4, reps: "5-8", rpe: 8 })).toBe("4 × 5–8 · RPE 8");
    expect(prescriptionLabel({ sets: 3, reps: 8 })).toBe("3 × 8");
    expect(prescriptionLabel({ sets: 3, reps: " 6 - 10 ", rpe: 7.5 })).toBe("3 × 6–10 · RPE 7.5");
  });
  it("adds the rest only when asked and only when there is one", () => {
    expect(prescriptionLabel({ sets: 4, reps: "5-8", rpe: 8, rest_sec: 150 }, { rest: true })).toBe("4 × 5–8 · RPE 8 · 2:30 rest");
    expect(prescriptionLabel({ sets: 4, reps: "5-8", rpe: 8, rest_sec: 150 })).toBe("4 × 5–8 · RPE 8");
    expect(prescriptionLabel({ sets: 2, reps: "12", rest_sec: null }, { rest: true })).toBe("2 × 12");
  });
  it("repsLabel leaves a single number alone", () => {
    expect(repsLabel(8)).toBe("8");
    expect(repsLabel("8")).toBe("8");
  });
});

describe("prescriptionGloss — the same dose as a sentence", () => {
  it("counts reps in reserve from the RPE", () => {
    expect(prescriptionGloss({ sets: 4, reps: "5-8", rpe: 8 })).toBe("4 sets of 5–8 reps, leaving about 2 reps in reserve.");
    expect(prescriptionGloss({ sets: 1, reps: "20", rpe: 9 })).toBe("1 set of 20 reps, leaving about 1 rep in reserve.");
    expect(prescriptionGloss({ sets: 3, reps: "", rpe: null })).toBe("3 sets of your target reps.");
    expect(prescriptionGloss({ sets: 5, reps: "6-10", rpe: 8.5 })).toBe("5 sets of 6–10 reps, leaving about 1–2 reps in reserve.");
  });
});
