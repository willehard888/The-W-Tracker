import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildEffectiveLibrary } from "../../../scripts/vault-content.mjs";

/**
 * The coach references Vault pieces by exact title from three hand-written
 * catalogs. A rewritten title that is not mirrored there makes the coach name
 * a piece that no longer exists; a wisdom piece missing from the catalog is
 * invisible to it. Both fail here.
 */
const pieces = buildEffectiveLibrary();
const titles = new Set(pieces.map((p) => p.title));
const catalogs = {
  "inner-work": readFileSync("supabase/functions/_shared/inner-work-catalog.ts", "utf8"),
  longevity: readFileSync("supabase/functions/_shared/longevity-catalog.ts", "utf8"),
  wisdom: readFileSync("supabase/functions/_shared/wisdom-catalog.ts", "utf8"),
};

/** Titles are the quoted strings on the catalogs' bullet lines; prose lines are rules, not names. */
const quotedTitles = (src: string) =>
  src
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .flatMap((line) => [...line.matchAll(/"([^"]{8,})"/g)].map((m) => m[1]));

describe("coach catalogs ↔ Vault titles", () => {
  it("every title a catalog quotes exists in the library", () => {
    for (const [name, src] of Object.entries(catalogs)) {
      for (const t of quotedTitles(src)) {
        expect(titles.has(t), `${name}: "${t}"`).toBe(true);
      }
    }
  });

  it("every wisdom piece is named in the wisdom catalog", () => {
    for (const p of pieces.filter((x) => x.category_id === "wisdom")) {
      expect(catalogs.wisdom.includes(`"${p.title}"`), p.title).toBe(true);
    }
  });

  it("every inner-work and longevity piece is named in its catalog", () => {
    for (const cat of ["inner-work", "longevity"] as const) {
      for (const p of pieces.filter((x) => x.category_id === cat)) {
        expect(catalogs[cat].includes(`"${p.title}"`), `${cat}: ${p.title}`).toBe(true);
      }
    }
  });
});
