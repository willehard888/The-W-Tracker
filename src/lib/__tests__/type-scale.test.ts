import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// The type and icon vocabulary is a contract the guard enforces; these pin the
// tokens it points at, so a renamed token fails here before it fails on a phone.
const css = readFileSync("src/index.css", "utf8");
const config = readFileSync("tailwind.config.ts", "utf8");

describe("type scale", () => {
  it("the named ladder runs label…beat and carries the display leading", () => {
    for (const step of ["label", "meta", "dense", "note", "read", "copy", "lead", "subhead", "head", "title", "major", "beat"]) {
      expect(config, step).toMatch(new RegExp(`^\\s+${step}: "\\d+px"`, "m"));
    }
    expect(config).toMatch(/display: "1\.04"/);
  });
  it("one clock: the default transition is 140 ms on the iOS curve", () => {
    expect(config).toMatch(/transitionDuration: \{\s*DEFAULT: "140ms"/);
    expect(config).toMatch(/transitionTimingFunction: \{\s*DEFAULT: "var\(--ease-ios\)"/);
  });
  it("the two title voices exist as classes", () => {
    expect(css).toMatch(/\.h-page \{\s*@apply font-display text-beat font-black tracking-tight leading-display;/);
    expect(css).toMatch(/\.h-card \{\s*@apply font-display text-lead font-black tracking-tight leading-tight;/);
  });
});
