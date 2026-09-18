import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPANY, COMPANY_ADDRESS, isValidBusinessId } from "@/lib/company";

// The seller on the App Store, the party in the Terms and the controller in the
// Privacy Policy must be one legal entity, spelled one way. The React pages
// import COMPANY; these copies cannot, so they are read and held to it here.
// The listing's "©" line once said "Whealth-Factory" — this catches that.
const COPIES = [
  "public/support.html",
  "public/waitlist.html",
  "supabase/functions/waitlist-welcome/index.ts",
  "scripts/asc-listing.mjs",
];

const read = (p: string) => readFileSync(resolve(__dirname, "../../..", p), "utf8");

describe("the legal entity", () => {
  it("is a Finnish limited company with a business ID whose check digit is right", () => {
    expect(COMPANY.name.endsWith(" Oy")).toBe(true);
    expect(isValidBusinessId(COMPANY.businessId)).toBe(true);
  });

  it("is spelled the same everywhere it has to be copied", () => {
    for (const path of COPIES) {
      expect(read(path), path).toContain(COMPANY.name);
    }
    for (const path of COPIES.filter((p) => !p.endsWith("asc-listing.mjs"))) {
      expect(read(path), path).toContain(COMPANY.businessId);
      expect(read(path), path).toContain(COMPANY.street);
    }
  });

  it("formats one address line", () => {
    expect(COMPANY_ADDRESS).toBe("Soukansalmentie 30 A, 02360 Espoo, Finland");
  });
});

describe("isValidBusinessId", () => {
  it("accepts real IDs and the remainder-zero case", () => {
    expect(isValidBusinessId("3636449-8")).toBe(true);
    // Weighted sum 0 → check digit 0.
    expect(isValidBusinessId("0000000-0")).toBe(true);
  });

  it("rejects a wrong check digit, the never-issued remainder 1, and bad shapes", () => {
    expect(isValidBusinessId("3636449-7")).toBe(false);
    // 1000006: 1·7 + 6·2 = 19, 19 mod 11 = 8 → check digit 11 − 8 = 3.
    expect(isValidBusinessId("1000006-3")).toBe(true);
    // 0000006: 6·2 = 12, 12 mod 11 = 1 — no check digit makes that valid.
    expect(isValidBusinessId("0000006-0")).toBe(false);
    expect(isValidBusinessId("0000006-1")).toBe(false);
    expect(isValidBusinessId("3636449")).toBe(false);
    expect(isValidBusinessId("363644-98")).toBe(false);
    expect(isValidBusinessId("abcdefg-8")).toBe(false);
  });
});
