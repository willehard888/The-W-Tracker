import { describe, it, expect } from "vitest";
import { SEGMENT_ACTIVE, SEGMENT_IDLE, SEGMENT_BUTTON, SEGMENT_TRACK } from "@/components/ui/segment";

// One segmented control: both states ride the same 140 ms clock, the idle
// segment answers a press with a surface, and the button itself opts out of
// the global press scale (a segment shrinking inside its track reads as a chip).
describe("segment constants", () => {
  it("both states carry the shared transition", () => {
    const clock = "duration-[140ms] [transition-timing-function:var(--ease-ios)]";
    expect(SEGMENT_ACTIVE).toContain(clock);
    expect(SEGMENT_IDLE).toContain(clock);
  });
  it("a press answers with a surface, not a scale", () => {
    expect(SEGMENT_IDLE).toMatch(/active:bg-/);
    expect(SEGMENT_ACTIVE).toMatch(/active:brightness-/);
    expect(SEGMENT_BUTTON.split(" ")).toContain("segment");
    expect(`${SEGMENT_ACTIVE} ${SEGMENT_IDLE} ${SEGMENT_BUTTON} ${SEGMENT_TRACK}`).not.toMatch(/scale-/);
  });
  it("the button prefix is the 44 pt floor and one type size", () => {
    expect(SEGMENT_BUTTON).toContain("min-h-11");
    expect(SEGMENT_BUTTON).toContain("text-meta font-black");
  });
});
