// Formatting is what the user reads; the values are locked so the diary
// never shows "0.5" where the design says "½".
import { describe, it, expect } from "vitest";
import { fmtQty, fmtKcal, fmtG, normalizeQuery, NBSP } from "../format";

describe("fmtQty", () => {
  it("uses fraction glyphs for ¼ ½ ¾ and mixed numbers", () => {
    expect(fmtQty(0.5)).toBe("½");
    expect(fmtQty(0.25)).toBe("¼");
    expect(fmtQty(0.75)).toBe("¾");
    expect(fmtQty(1.5)).toBe("1½");
    expect(fmtQty(2.25)).toBe("2¼");
  });

  it("integers stay plain, others get up to 2 trimmed decimals", () => {
    expect(fmtQty(2)).toBe("2");
    expect(fmtQty(0)).toBe("0");
    expect(fmtQty(1.1)).toBe("1.1");
    expect(fmtQty(1.3333)).toBe("1.33");
    expect(fmtQty(0.999)).toBe("1");
  });

  it("edge inputs: NaN → empty, negatives keep their sign without glyphs", () => {
    expect(fmtQty(NaN)).toBe("");
    expect(fmtQty(-1.5)).toBe("-1.5");
  });
});

describe("fmtKcal", () => {
  it("rounds to an integer and groups thousands with a no-break space", () => {
    expect(fmtKcal(1240)).toBe(`1${NBSP}240`);
    expect(fmtKcal(1239.6)).toBe(`1${NBSP}240`);
    expect(fmtKcal(999)).toBe("999");
    expect(fmtKcal(1234567)).toBe(`1${NBSP}234${NBSP}567`);
    expect(NBSP).toBe(" ");
  });

  it("handles negatives and non-finite", () => {
    expect(fmtKcal(-1240)).toBe(`-1${NBSP}240`);
    expect(fmtKcal(NaN)).toBe("—");
  });
});

describe("fmtG", () => {
  it("one decimal up to 10 g (boundary inclusive), integers above", () => {
    expect(fmtG(8.54)).toBe("8.5");
    expect(fmtG(10)).toBe("10.0");
    expect(fmtG(10.4)).toBe("10");
    expect(fmtG(125.6)).toBe("126");
    expect(fmtG(Infinity)).toBe("—");
  });
});

describe("normalizeQuery", () => {
  it("trims, collapses whitespace, lowercases and strips diacritics", () => {
    expect(normalizeQuery("  Kanan   Rinta ")).toBe("kanan rinta");
    expect(normalizeQuery("Broileri Ä")).toBe("broileri a");
    expect(normalizeQuery("crème brûlée")).toBe("creme brulee");
    expect(normalizeQuery("")).toBe("");
  });
});
