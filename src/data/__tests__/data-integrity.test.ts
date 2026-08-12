// Integrity locks over hand-maintained data. These catch the silent failure
// modes of content edits: a recipe id without a bundled image (gold fallback
// square forever), a daily insight pointing at a lesson slug that doesn't
// exist (dead deep link to the paywalled Vault), duplicate ids.
import { describe, it, expect } from "vitest";
import { RECIPES } from "@/data/recipes";
import { DAILY_INSIGHTS } from "@/data/daily-insights";
import { recipeThumb, recipePoster, recipeSquare } from "@/lib/recipe-images";
import { fmtQty } from "@/lib/recipe-scaling";

describe("recipes catalog", () => {
  it("ids are unique", () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  it("every recipe has all three bundled images (thumb, poster, square)", () => {
    for (const r of RECIPES) {
      expect(recipeThumb(r.id), `${r.id} thumb`).toBeTruthy();
      expect(recipePoster(r.id), `${r.id} poster`).toBeTruthy();
      expect(recipeSquare(r.id), `${r.id} square`).toBeTruthy();
    }
  });

  it("quantities are non-negative and nutrition is sane", () => {
    for (const r of RECIPES) {
      expect(r.nutrition.calories).toBeGreaterThan(0);
      expect(r.nutrition.protein).toBeGreaterThan(0);
      for (const g of r.groups) {
        for (const it of g.items) {
          if (it.qty != null) expect(it.qty, `${r.id}: ${it.item}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("fmtQty — the shopping-list math users cook from", () => {
  it("scales and rounds to 2 decimals", () => {
    expect(fmtQty(1.5, 3)).toBe("4.5");
    expect(fmtQty(0.33, 3)).toBe("0.99");
    expect(fmtQty(0.333, 3)).toBe("1"); // 0.999 → 1
  });

  it("undefined quantity renders empty (freeform items like 'to taste')", () => {
    expect(fmtQty(undefined, 5)).toBe("");
  });
});

describe("daily insights ↔ Inner Work lessons", () => {
  // Slugs seeded by 20260811085218_vault_inner_work_content.sql — the deep
  // link /vault?lesson=<slug> dies silently if these drift.
  const LESSON_SLUGS = new Set([
    "inner-operating-system",
    "manifestation-demystified",
    "woop-mental-contrasting",
    "visualization-that-works",
    "elevate-your-energy",
    "gratitude-savoring",
    "distanced-self-talk",
    "authentic-self-image",
    "letting-go",
    "inner-work-recap",
  ]);

  it("every insight points at a real lesson slug", () => {
    for (const i of DAILY_INSIGHTS) {
      expect(LESSON_SLUGS.has(i.lessonSlug), `${i.id} → ${i.lessonSlug}`).toBe(true);
    }
  });

  it("insight ids are unique and texts are within card budget", () => {
    expect(new Set(DAILY_INSIGHTS.map((i) => i.id)).size).toBe(DAILY_INSIGHTS.length);
    for (const i of DAILY_INSIGHTS) {
      expect(i.text.length, i.id).toBeLessThanOrEqual(160);
    }
  });
});
