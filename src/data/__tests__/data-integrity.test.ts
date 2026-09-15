// Integrity locks over hand-maintained data. These catch the silent failure
// modes of content edits: a recipe id without a bundled image (gold fallback
// square forever), a daily insight pointing at a lesson slug that doesn't
// exist (dead deep link to the paywalled Vault), duplicate ids.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { RECIPES } from "@/data/recipes";
import { DAILY_INSIGHTS } from "@/data/daily-insights";
import { recipeThumb, recipeSquare } from "@/lib/recipe-images";
import { fmtQty } from "@/lib/recipe-scaling";

describe("recipes catalog", () => {
  it("ids are unique", () => {
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  // Two sizes now, not three: the `poster` set was a cream-background recipe
  // CARD with every quantity baked in as pixels. The screen renders that as
  // text, so the photograph is all that's left to bundle.
  it("every recipe has both bundled photos (thumb, square)", () => {
    for (const r of RECIPES) {
      expect(recipeThumb(r.id), `${r.id} thumb`).toBeTruthy();
      expect(recipeSquare(r.id), `${r.id} square`).toBeTruthy();
    }
  });

  it("every recipe carries method steps and at least one tag", () => {
    for (const r of RECIPES) {
      expect(r.method.length, `${r.id} method`).toBeGreaterThan(0);
      for (const phase of r.method) {
        expect(phase.steps.length, `${r.id}: ${phase.title}`).toBeGreaterThan(0);
      }
      // The list filters by tag, so an untagged recipe is unreachable there.
      expect(r.tags.length, `${r.id} tags`).toBeGreaterThan(0);
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

describe("daily insights ↔ Vault lessons", () => {
  // Slugs seeded by 20260811085218_vault_inner_work_content.sql,
  // 20260820061501_vault_longevity_content.sql and
  // 20260916090001_vault_wisdom_content.sql — the deep link
  // /vault?lesson=<slug> dies silently if these drift.
  const WISDOM_SLUGS = [
    "how-to-read-a-teacher",
    "atomic-habits-identity",
    "power-of-now-presence",
    "new-earth-ego",
    "greatest-secret-awareness",
    "eight-forms-of-wealth",
    "jung-shadow-individuation",
    "dispenza-rehearsal",
    "huberman-protocol-stack",
    "watts-wisdom-of-insecurity",
    "wisdom-practice-stack",
  ];
  const LESSON_SLUGS = new Set([
    ...WISDOM_SLUGS,
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
    "healthspan-vs-lifespan",
    "hierarchy-of-longevity-levers",
    "vo2max-strongest-predictor",
    "strength-longevity-organ",
    "protein-aging-athlete",
    "sleep-repair-budget",
    "metabolic-health-waistline",
    "connection-purpose-longevity",
    "supplement-graveyard",
    "hundred-year-operating-system",
  ]);

  it("every insight points at a real lesson slug", () => {
    for (const i of DAILY_INSIGHTS) {
      expect(LESSON_SLUGS.has(i.lessonSlug), `${i.id} → ${i.lessonSlug}`).toBe(true);
    }
  });

  // The Wisdom course is an 11-row SQL literal. A typo in a quiz or reference
  // JSON would only surface at `db push`; this reads the migration and parses
  // every jsonb literal the way Postgres will.
  it("the wisdom migration's JSON parses and every quiz answer is in range", () => {
    const sql = readFileSync("supabase/migrations/20260916090001_vault_wisdom_content.sql", "utf8");
    for (const slug of WISDOM_SLUGS) expect(sql.includes(`('wisdom', '${slug}',`), slug).toBe(true);
    const literals = [...sql.matchAll(/'(\[[\s\S]*?\])'::jsonb/g)].map((m) => JSON.parse(m[1].replace(/''/g, "'")) as unknown[]);
    const quizzes = literals.filter((l) => (l[0] as { q?: string })?.q);
    const refs = literals.filter((l) => (l[0] as { author?: string })?.author);
    expect(quizzes).toHaveLength(WISDOM_SLUGS.length);
    expect(refs).toHaveLength(WISDOM_SLUGS.length);
    for (const quiz of quizzes as { q: string; choices: string[]; correct: number; explain: string }[][]) {
      expect(quiz.length).toBeGreaterThanOrEqual(2);
      for (const q of quiz) {
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(q.choices.length);
        expect(q.explain.length).toBeGreaterThan(0);
      }
    }
    for (const r of refs as { author: string; title: string }[][]) {
      expect(r.length).toBeGreaterThanOrEqual(2);
      expect(r.some((x) => x.author === "Note"), "every lesson carries the attribution note").toBe(true);
    }
  });

  it("every Wisdom lesson has at least four voices on Home, each naming its teacher", () => {
    const wisdom = DAILY_INSIGHTS.filter((i) => i.id.startsWith("wis-"));
    for (const slug of WISDOM_SLUGS) {
      expect(wisdom.filter((i) => i.lessonSlug === slug).length, slug).toBeGreaterThanOrEqual(4);
    }
    for (const i of wisdom) expect(i.source, i.id).toBeTruthy();
  });

  it("insight ids are unique and texts are within card budget", () => {
    expect(new Set(DAILY_INSIGHTS.map((i) => i.id)).size).toBe(DAILY_INSIGHTS.length);
    for (const i of DAILY_INSIGHTS) {
      expect(i.text.length, i.id).toBeLessThanOrEqual(160);
    }
  });
});
