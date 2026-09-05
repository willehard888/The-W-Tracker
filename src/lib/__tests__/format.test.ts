import { describe, expect, it } from "vitest";
import { NBSP, fmtDate, fmtG, fmtInt, fmtKcal, fmtRelative, fmtUnit } from "@/lib/format";

describe("fmtInt", () => {
  it("groups thousands with NBSP and rounds", () => {
    expect(fmtInt(1240)).toBe(`1${NBSP}240`);
    expect(fmtInt(1234567.6)).toBe(`1${NBSP}234${NBSP}568`);
    expect(fmtInt(999)).toBe("999");
    expect(fmtInt(0)).toBe("0");
  });
  it("keeps the sign and dashes non-finite", () => {
    expect(fmtInt(-1500)).toBe(`-1${NBSP}500`);
    expect(fmtInt(NaN)).toBe("—");
    expect(fmtInt(Infinity)).toBe("—");
  });
  it("fmtKcal is the same formatter", () => {
    expect(fmtKcal).toBe(fmtInt);
  });
});

describe("fmtG / fmtUnit", () => {
  it("one decimal up to 10 g, integers above, dash for non-finite", () => {
    expect(fmtG(2.34)).toBe("2.3");
    expect(fmtG(10)).toBe("10.0");
    expect(fmtG(12.6)).toBe("13");
    expect(fmtG(NaN)).toBe("—");
  });
  it("glues the unit with NBSP", () => {
    expect(fmtUnit(1240, "XP")).toBe(`1${NBSP}240${NBSP}XP`);
  });
});

describe("fmtDate", () => {
  const now = new Date("2026-09-05T12:00:00Z");
  it("drops the year inside the current year", () => {
    expect(fmtDate("2026-08-24T10:00:00Z", now)).toBe("Aug 24");
  });
  it("adds the year otherwise", () => {
    expect(fmtDate("2025-12-31T10:00:00Z", now)).toBe("Dec 31, 2025");
  });
  it("is empty for garbage", () => {
    expect(fmtDate("nope", now)).toBe("");
  });
});

describe("fmtRelative", () => {
  const now = Date.parse("2026-09-05T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it("covers every span", () => {
    expect(fmtRelative(ago(20_000), now)).toBe("just now");
    expect(fmtRelative(ago(5 * 60_000), now)).toBe("5m ago");
    expect(fmtRelative(ago(3 * 3_600_000), now)).toBe("3h ago");
    expect(fmtRelative(ago(6 * 86_400_000), now)).toBe("6d ago");
    expect(fmtRelative(ago(12 * 86_400_000), now)).toBe("Aug 24");
  });
  it("speaks the future and accepts Date / number inputs", () => {
    expect(fmtRelative(new Date(now + 2 * 86_400_000), now)).toBe("in 2d");
    expect(fmtRelative(now + 90_000, now)).toBe("in 1m");
  });
  it("is empty for garbage", () => {
    expect(fmtRelative("nope", now)).toBe("");
  });
});
