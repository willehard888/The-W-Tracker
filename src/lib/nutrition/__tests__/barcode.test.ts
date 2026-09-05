// The normalised code is the food_barcodes primary key — one wrong digit is a
// wrong product. Vectors are hand-checked against the GS1 algorithm.
import { describe, it, expect } from "vitest";
import { normalizeBarcode, isValidGs1, gs1CheckDigit, expandUpcE, extractGtin } from "../barcode";

const INVALID = { ok: false, reason: "invalid" };

describe("isValidGs1 / gs1CheckDigit", () => {
  it("accepts known-good EAN-13, EAN-8, UPC-A and GTIN-14", () => {
    expect(isValidGs1("4006381333931")).toBe(true);
    expect(isValidGs1("96385074")).toBe(true);
    expect(isValidGs1("036000291452")).toBe(true);
    expect(isValidGs1("04006381333931")).toBe(true);
  });

  it("rejects a wrong check digit, wrong lengths and non-digits", () => {
    expect(isValidGs1("4006381333932")).toBe(false);
    expect(isValidGs1("1234567")).toBe(false);
    expect(isValidGs1("400638133393a")).toBe(false);
    expect(isValidGs1("")).toBe(false);
  });

  it("computes the check digit (weights 3,1,… from the right)", () => {
    expect(gs1CheckDigit("400638133393")).toBe(1);
    expect(gs1CheckDigit("9638507")).toBe(4);
    expect(gs1CheckDigit("0000000")).toBe(0); // the (10 − 0) % 10 branch
  });
});

describe("expandUpcE — the five last-digit patterns", () => {
  it("d6 ∈ 0..2 → ns d1 d2 d6 0000 d3 d4 d5", () => {
    expect(expandUpcE("04252614")).toBe("042100005264"); // textbook vector
    expect(expandUpcE("123450")).toBe("012000003455");
  });

  it("d6 = 3 → ns d1 d2 d3 00000 d4 d5", () => {
    expect(expandUpcE("123453")).toBe("012300000451");
  });

  it("d6 = 4 → ns d1 d2 d3 d4 00000 d5", () => {
    expect(expandUpcE("123454")).toBe("012340000053");
  });

  it("d6 ∈ 5..9 → ns d1 d2 d3 d4 d5 0000 d6", () => {
    expect(expandUpcE("123456")).toBe("012345000065");
  });

  it("accepts a 7-digit form with number system 1, computing the check", () => {
    expect(expandUpcE("1123456")).toBe("112345000062");
  });

  it("rejects number systems other than 0/1, wrong lengths and a wrong check digit", () => {
    expect(expandUpcE("2123456")).toBeNull();
    expect(expandUpcE("12345")).toBeNull();
    expect(expandUpcE("123456789")).toBeNull();
    expect(expandUpcE("04252615")).toBeNull();
  });
});

describe("normalizeBarcode", () => {
  it("EAN-13 and EAN-8 pass through", () => {
    expect(normalizeBarcode("4006381333931", "EAN_13")).toEqual({ ok: true, code: "4006381333931" });
    expect(normalizeBarcode("96385074", "EAN_8")).toEqual({ ok: true, code: "96385074" });
    expect(normalizeBarcode("96385074")).toEqual({ ok: true, code: "96385074" });
  });

  it("UPC-A gets a leading 0", () => {
    expect(normalizeBarcode("036000291452", "UPC_A")).toEqual({ ok: true, code: "0036000291452" });
    expect(normalizeBarcode("036000291452")).toEqual({ ok: true, code: "0036000291452" });
  });

  it("UPC-E expands to UPC-A then to EAN-13", () => {
    expect(normalizeBarcode("04252614", "UPC_E")).toEqual({ ok: true, code: "0042100005264" });
    expect(normalizeBarcode("425261", "UPC_E")).toEqual({ ok: true, code: "0042100005264" });
    expect(normalizeBarcode("04252615", "UPC_E")).toEqual({ ok: false, reason: "invalid" });
  });

  // Shared with nutrition-lookup-map.test.ts and scripts/nutrition/calc-check.sql — three mirrors.
  it("GTIN-14 → its consumer-unit GTIN-13; indicator 9 (variable measure) and a bad check digit are invalid", () => {
    expect(normalizeBarcode("04006381333931")).toEqual({ ok: true, code: "4006381333931" });
    expect(normalizeBarcode("14006381333938")).toEqual({ ok: true, code: "4006381333931" });
    expect(normalizeBarcode("24006381333935")).toEqual({ ok: true, code: "4006381333931" });
    expect(normalizeBarcode("94006381333934")).toEqual(INVALID);
    expect(normalizeBarcode("14006381333939")).toEqual(INVALID);
  });

  it("a 00000-padded EAN-8 (13 or 14 digits) → 8", () => {
    expect(normalizeBarcode("0000096385074")).toEqual({ ok: true, code: "96385074" });
    expect(normalizeBarcode("00000096385074")).toEqual({ ok: true, code: "96385074" });
  });

  it("ITF-14, Code 128 AI (01) and GS1 Digital Link payloads carry a GTIN; anything else is invalid", () => {
    expect(normalizeBarcode("14006381333938", "ITF_14")).toEqual({ ok: true, code: "4006381333931" });
    expect(normalizeBarcode("0104006381333931172612311021AB", "CODE_128")).toEqual({ ok: true, code: "4006381333931" });
    expect(normalizeBarcode("ABC123", "CODE_128")).toEqual(INVALID);
    expect(normalizeBarcode("https://id.gs1.org/01/09506000134352/10/ABC", "QR_CODE")).toEqual({ ok: true, code: "9506000134352" });
    expect(normalizeBarcode("https://example.com", "QR_CODE")).toEqual(INVALID);
    expect(extractGtin("https://id.gs1.org/01/9506000134352?10=ABC", "DATA_MATRIX")).toBe("9506000134352");
    expect(extractGtin("https://id.gs1.org/01/123456789/10/ABC", "DATA_MATRIX")).toBeNull(); // 9 digits is no GTIN length
    expect(extractGtin("96385074", "EAN_8")).toBe("96385074");
  });

  it("strips non-digits before validating", () => {
    expect(normalizeBarcode(" 4 006381-333931 ")).toEqual({ ok: true, code: "4006381333931" });
  });

  it("invalid: bad check digit, odd lengths, empty, letters", () => {
    for (const raw of ["4006381333932", "12345", "", "abc", "1234567890"]) {
      expect(normalizeBarcode(raw)).toEqual({ ok: false, reason: "invalid" });
    }
  });
});
