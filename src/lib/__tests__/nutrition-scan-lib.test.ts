// Pure scanner logic lives in the edge function folder (Deno bundler needs it
// there); it has no Deno imports so vitest can test it directly.
import { describe, it, expect } from "vitest";
import {
  validateScanArgs,
  pickCandidate,
  overallConfidence,
  mapUpstreamError,
  buildToolSchema,
  GRAM_PRIORS,
  MAX_ITEMS,
  type Candidate,
} from "../../../supabase/functions/nutrition-scan/lib";

const item = (over: Record<string, unknown> = {}) => ({
  name: "Chicken breast",
  canonical_search_terms: ["chicken breast", "broileri"],
  category: "protein",
  preparation: "grilled",
  estimated_grams: 150,
  grams_low: 120,
  grams_high: 180,
  portion_confidence: 0.6,
  identification_confidence: 0.9,
  is_liquid: false,
  count: null,
  ...over,
});
const args = (items: unknown[], over: Record<string, unknown> = {}) => ({ is_food: true, scene_notes: "plate", items, ...over });

describe("validateScanArgs", () => {
  it("rejects null, {} and non-array items", () => {
    expect(validateScanArgs(null)).toBeNull();
    expect(validateScanArgs({})).toBeNull();
    expect(validateScanArgs({ items: "x" })).toBeNull();
  });

  it("passes a clean item through", () => {
    const v = validateScanArgs(args([item()]));
    expect(v?.is_food).toBe(true);
    expect(v?.items).toHaveLength(1);
    expect(v?.items[0]).toMatchObject({ name: "Chicken breast", estimated_grams: 150, grams_low: 120, grams_high: 180 });
  });

  it("drops items without a usable name", () => {
    const v = validateScanArgs(args([item({ name: undefined }), item({ name: "   " }), item({ name: 42 })]));
    expect(v?.items).toHaveLength(0);
  });

  it("trims and caps the name at 60", () => {
    const v = validateScanArgs(args([item({ name: "  " + "a".repeat(80) })]));
    expect(v?.items[0].name).toHaveLength(60);
  });

  it("drops items whose grams are not finite numbers", () => {
    const v = validateScanArgs(args([item({ estimated_grams: "abc" }), item({ estimated_grams: NaN })]));
    expect(v?.items).toHaveLength(0);
  });

  it("caps 13 items to 12", () => {
    const v = validateScanArgs(args(Array.from({ length: 13 }, () => item())));
    expect(v?.items).toHaveLength(MAX_ITEMS);
  });

  it("clamps 5000 g to 2000 and then to the category prior", () => {
    const v = validateScanArgs(args([item({ category: "fat_oil", estimated_grams: 5000, grams_low: 5000, grams_high: 5000 })]));
    expect(v?.items[0].estimated_grams).toBe(GRAM_PRIORS.fat_oil[1]);
    const w = validateScanArgs(args([item({ category: "other", estimated_grams: 5000, grams_low: 5000, grams_high: 5000 })]));
    expect(w?.items[0].estimated_grams).toBe(2000);
  });

  it("fixes an inverted low/high range so low ≤ est ≤ high", () => {
    const v = validateScanArgs(args([item({ estimated_grams: 150, grams_low: 300, grams_high: 50 })]));
    const it0 = v!.items[0];
    expect(it0.grams_low).toBeLessThanOrEqual(it0.estimated_grams);
    expect(it0.grams_high).toBeGreaterThanOrEqual(it0.estimated_grams);
  });

  it("coerces unknown category/preparation to other/unknown", () => {
    const v = validateScanArgs(args([item({ category: "meat", preparation: "sous-vide" })]));
    expect(v?.items[0].category).toBe("other");
    expect(v?.items[0].preparation).toBe("unknown");
  });

  it("count must be an integer 1–50, else null", () => {
    const v = validateScanArgs(args([item({ count: 3 }), item({ count: 0 }), item({ count: 51 }), item({ count: 2.5 }), item({ count: "2" })]));
    expect(v?.items.map((i) => i.count)).toEqual([3, null, null, null, null]);
  });

  it("filters search terms to 1–4 strings ≤ 40 and falls back to the name", () => {
    const v = validateScanArgs(args([
      item({ canonical_search_terms: ["a", 1, "", "b".repeat(50), "c", "d", "e"] }),
      item({ canonical_search_terms: [] }),
      item({ canonical_search_terms: "nope" }),
    ]));
    expect(v?.items[0].canonical_search_terms).toEqual(["a", "b".repeat(40), "c", "d"]);
    expect(v?.items[1].canonical_search_terms).toEqual(["Chicken breast"]);
    expect(v?.items[2].canonical_search_terms).toEqual(["Chicken breast"]);
  });

  it("clamps confidences to [0,1] and caps scene_notes at 200", () => {
    const v = validateScanArgs(args([item({ portion_confidence: 7, identification_confidence: -1 })], { scene_notes: "x".repeat(300) }));
    expect(v?.items[0].portion_confidence).toBe(1);
    expect(v?.items[0].identification_confidence).toBe(0);
    expect(v?.scene_notes).toHaveLength(200);
    expect(validateScanArgs(args([], { scene_notes: 5 }))?.scene_notes).toBe("");
  });

  it("is_food is only true when literally true", () => {
    expect(validateScanArgs(args([], { is_food: "yes" }))?.is_food).toBe(false);
  });
});

const cand = (food_id: string, similarity: number): Candidate => ({
  food_id,
  name: food_id,
  brand: null,
  similarity,
  per_100g: { kcal: 100, protein_g: 10, carbs_g: 5, fat_g: 3 },
});

describe("pickCandidate", () => {
  it("auto-selects on the happy path", () => {
    const r = pickCandidate([cand("a", 0.8), cand("b", 0.5)], 0.9);
    expect(r.selected?.food_id).toBe("a");
    expect(r.needs_user_choice).toBe(false);
  });

  it("needs a choice when identification confidence is below 0.7", () => {
    expect(pickCandidate([cand("a", 0.8)], 0.6).needs_user_choice).toBe(true);
  });

  it("needs a choice when top similarity is below 0.45", () => {
    expect(pickCandidate([cand("a", 0.44)], 0.95).needs_user_choice).toBe(true);
  });

  it("needs a choice when the margin to the runner-up is under 0.10", () => {
    const r = pickCandidate([cand("a", 0.6), cand("b", 0.55)], 0.95);
    expect(r.needs_user_choice).toBe(true);
    expect(r.selected).toBeNull();
  });

  it("dedupes by food_id keeping the max similarity and sorts descending", () => {
    const r = pickCandidate([cand("a", 0.3), cand("b", 0.5), cand("a", 0.9)], 0.95);
    expect(r.candidates.map((c) => [c.food_id, c.similarity])).toEqual([["a", 0.9], ["b", 0.5]]);
    expect(r.selected?.food_id).toBe("a");
  });

  it("empty candidates → choice with null", () => {
    expect(pickCandidate([], 0.99)).toEqual({ selected: null, needs_user_choice: true, candidates: [] });
  });
});

describe("overallConfidence", () => {
  it("is the mean of id × (0.5 + 0.5 × portion)", () => {
    const v = overallConfidence([
      { identification_confidence: 1, portion_confidence: 1, needs_user_choice: false }, // 1.0
      { identification_confidence: 0.8, portion_confidence: 0.5, needs_user_choice: false }, // 0.6
    ]);
    expect(v).toBeCloseTo(0.8, 5);
  });

  it("is forced ≤ 0.49 when any item needs a choice", () => {
    const v = overallConfidence([
      { identification_confidence: 1, portion_confidence: 1, needs_user_choice: false },
      { identification_confidence: 1, portion_confidence: 1, needs_user_choice: true },
    ]);
    expect(v).toBe(0.49);
  });

  it("is 0 for no items", () => {
    expect(overallConfidence([])).toBe(0);
  });
});

describe("mapUpstreamError", () => {
  it("maps every branch", () => {
    expect(mapUpstreamError(402)).toEqual({ http: 503, error: "ai_unavailable", retryable: false });
    expect(mapUpstreamError(429)).toEqual({ http: 503, error: "ai_unavailable", retryable: true });
    expect(mapUpstreamError(500)).toEqual({ http: 503, error: "ai_unavailable", retryable: true });
    expect(mapUpstreamError(503)).toEqual({ http: 503, error: "ai_unavailable", retryable: true });
    expect(mapUpstreamError("invalid")).toEqual({ http: 502, error: "invalid_ai_response", retryable: true });
    expect(mapUpstreamError("abort")).toEqual({ http: 504, error: "ai_timeout", retryable: true });
    expect(mapUpstreamError(400)).toEqual({ http: 502, error: "ai_unavailable", retryable: false });
    expect(mapUpstreamError(404)).toEqual({ http: 502, error: "ai_unavailable", retryable: false });
  });
});

describe("buildToolSchema", () => {
  const schema = buildToolSchema();
  const walk = (node: unknown, visit: (n: Record<string, unknown>) => void) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
    if (typeof node !== "object" || node === null) return;
    const rec = node as Record<string, unknown>;
    visit(rec);
    Object.values(rec).forEach((v) => walk(v, visit));
  };

  it("has no nutrient field anywhere", () => {
    const names: string[] = [];
    walk(schema, (n) => {
      if (n.type === "object" && typeof n.properties === "object" && n.properties) names.push(...Object.keys(n.properties as object));
    });
    expect(names.length).toBeGreaterThan(0);
    for (const k of names) expect(k).not.toMatch(/kcal|protein|carb|fat|nutrient|calorie|energy/i);
  });

  it("every object level is additionalProperties:false with all properties required", () => {
    let objects = 0;
    walk(schema, (n) => {
      if (n.type !== "object") return;
      objects++;
      expect(n.additionalProperties).toBe(false);
      expect([...(n.required as string[])].sort()).toEqual(Object.keys(n.properties as object).sort());
    });
    expect(objects).toBe(2);
    expect(schema.function.name).toBe("report_food_items");
  });
});

describe("buildToolSchema — Gemini compatibility", () => {
  it("uses no type unions anywhere (Gemini rejects `type: [..., \"null\"]` with a 400)", () => {
    const unions: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (!node || typeof node !== "object") return;
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "type" && Array.isArray(v)) unions.push(path);
        walk(v, `${path}.${k}`);
      }
    };
    walk(buildToolSchema(), "schema");
    expect(unions).toEqual([]);
  });

  it("maps count 0 (the schema's 'not countable') to null", () => {
    const base = {
      is_food: true, scene_notes: "", items: [{
        name: "rice", canonical_search_terms: ["rice"], category: "grain", preparation: "boiled",
        estimated_grams: 150, grams_low: 120, grams_high: 200, portion_confidence: 0.6,
        identification_confidence: 0.9, is_liquid: false, count: 0,
      }],
    };
    expect(validateScanArgs(base)?.items[0].count).toBeNull();
    expect(validateScanArgs({ ...base, items: [{ ...base.items[0], count: 3 }] })?.items[0].count).toBe(3);
  });
});
