import { describe, it, expect } from "vitest";
import { breathPhase, cueIndex, cycleSec, pacerScale } from "@/lib/recovery/pace";
import type { BreathPhase } from "@/data/recovery";

const BOX: BreathPhase[] = [["In", 4], ["Hold", 4], ["Out", 4], ["Hold", 4]];
const SIGH: BreathPhase[] = [["In", 2], ["In", 1], ["Out", 6]];

describe("breathPhase", () => {
  it("starts on the first phase", () => {
    expect(breathPhase(BOX, 0)).toMatchObject({ index: 0, label: "In" });
  });

  it("changes phase exactly on the boundary", () => {
    expect(breathPhase(BOX, 3999).index).toBe(0);
    expect(breathPhase(BOX, 4000)).toMatchObject({ index: 1, label: "Hold" });
    expect(breathPhase(BOX, 8000)).toMatchObject({ index: 2, label: "Out" });
  });

  it("wraps into the next cycle", () => {
    expect(cycleSec(BOX)).toBe(16);
    expect(breathPhase(BOX, 16_000).index).toBe(0);
    expect(breathPhase(BOX, 16_000 * 7 + 12_500).index).toBe(3);
  });

  it("handles fractional counts", () => {
    const even: BreathPhase[] = [["In", 5.5], ["Out", 5.5]];
    expect(breathPhase(even, 5499).label).toBe("In");
    expect(breathPhase(even, 5500).label).toBe("Out");
  });
});

describe("pacerScale", () => {
  it("fills on in, empties on out, and a hold keeps the level", () => {
    expect(pacerScale(BOX, 0)).toBe(1);
    expect(pacerScale(BOX, 1)).toBe(1);
    expect(pacerScale(BOX, 2)).toBe(0.55);
    expect(pacerScale(BOX, 3)).toBe(0.55);
  });

  it("tops up on a second inhale instead of restarting", () => {
    expect(pacerScale(SIGH, 0)).toBe(0.85);
    expect(pacerScale(SIGH, 1)).toBe(1);
  });
});

describe("cueIndex", () => {
  const cues: [number, string][] = [[0, "a"], [20, "b"], [50, "c"]];
  it("shows the first cue from the start", () => expect(cueIndex(cues, 0)).toBe(0));
  it("moves on when a cue's second arrives", () => {
    expect(cueIndex(cues, 19_999)).toBe(0);
    expect(cueIndex(cues, 20_000)).toBe(1);
  });
  it("stays on the last cue after it", () => expect(cueIndex(cues, 999_000)).toBe(2));
});
