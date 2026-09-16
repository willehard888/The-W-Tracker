import { describe, expect, it } from "vitest";
import {
  buildEffectiveLibrary,
  lintLibrary,
  loadBase,
  REWRITTEN_CATEGORIES,
  rewriteMigrationFiles,
} from "../../../scripts/vault-content.mjs";

/**
 * The Vault in one voice (docs/VAULT_VOICE.md). The effective library is the
 * 2026-09-16 baseline plus every rewrite migration; a shelf listed in
 * REWRITTEN_CATEGORIES must lint clean and can never regress. Shelves not yet
 * rewritten are reported, not failed, so the rewrite can land one push at a
 * time.
 */
const pieces = buildEffectiveLibrary();
const findings = lintLibrary(pieces);
const catOf = (slug: string) => pieces.find((p) => p.slug === slug)?.category_id ?? slug.replace(/[()]/g, "");

describe("Vault voice", () => {
  it("builds the effective library from the baseline and the rewrite migrations", () => {
    expect(loadBase().length).toBe(95);
    expect(rewriteMigrationFiles().length).toBeGreaterThan(0);
    expect(pieces.length).toBeGreaterThan(80);
    expect(new Set(pieces.map((p) => p.slug)).size).toBe(pieces.length);
  });

  it("every rewritten shelf lints clean", () => {
    const hard = findings.filter((f) => REWRITTEN_CATEGORIES.includes(catOf(f.slug)));
    expect(hard.map((f) => `${f.slug} · ${f.field} · ${f.rule} · ${f.sample}`)).toEqual([]);
  });

  it("numbered shelves read as one course: 1..n with no gaps, one foundations, a recap last where there is one", () => {
    for (const cat of REWRITTEN_CATEGORIES) {
      const shelf = pieces.filter((p) => p.category_id === cat && p.lesson_number != null).sort((a, b) => (a.lesson_number ?? 0) - (b.lesson_number ?? 0));
      expect(shelf.map((p) => p.lesson_number)).toEqual(shelf.map((_, i) => i + 1));
      expect(shelf.filter((p) => p.course_role === "foundations").length).toBeLessThanOrEqual(1);
      const recap = shelf.findIndex((p) => p.course_role === "recap");
      if (recap >= 0) expect(recap).toBe(shelf.length - 1);
    }
  });

  it("reports the shelves still to rewrite (informational)", () => {
    const byCat = new Map<string, number>();
    for (const f of findings) byCat.set(catOf(f.slug), (byCat.get(catOf(f.slug)) ?? 0) + 1);
    // Not an assertion: the number falls to zero shelf by shelf.
    expect([...byCat.keys()].every((c) => typeof c === "string")).toBe(true);
  });
});
