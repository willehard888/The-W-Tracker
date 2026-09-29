import { describe, expect, it } from "vitest";
import { dismissesOnRelease } from "../sheet-bottom";

// Pull the handle: a third of the way or a flick closes; a nudge springs back.
describe("bottom sheet — release", () => {
  it("closes on a long pull regardless of speed", () => {
    expect(dismissesOnRelease(97, 0)).toBe(true);
    expect(dismissesOnRelease(300, -200)).toBe(true);
  });
  it("closes on a flick that moved a little", () => {
    expect(dismissesOnRelease(40, 800)).toBe(true);
  });
  it("springs back from a nudge, a slow short pull, or a flick that never left", () => {
    expect(dismissesOnRelease(10, 0)).toBe(false);
    expect(dismissesOnRelease(60, 200)).toBe(false);
    expect(dismissesOnRelease(5, 2000)).toBe(false);
    expect(dismissesOnRelease(-40, 900)).toBe(false);
  });
});
