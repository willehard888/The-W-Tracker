import { describe, it, expect } from "vitest";
import { confidenceTier, parseScanResponse } from "../scan-types";

const candidate = (food_id = "f1", similarity = 0.8) => ({
  food_id,
  name: "Chicken breast, cooked",
  brand: null,
  similarity,
  per_100g: { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
});

const item = (over: Record<string, unknown> = {}) => ({
  id: "i1",
  name: "grilled chicken breast",
  category: "protein",
  preparation: "grilled",
  grams: 150,
  grams_low: 100,
  grams_high: 200,
  count: null,
  is_liquid: false,
  identification_confidence: 0.9,
  portion_confidence: 0.6,
  needs_user_choice: false,
  selected_food_id: "f1",
  candidates: [candidate()],
  preview: { kcal: 247.5, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 },
  ...over,
});

const response = (over: Record<string, unknown> = {}) => ({
  estimated: true,
  overall_confidence: 0.8,
  low_confidence: false,
  not_food: false,
  scene_notes: "plate ~26cm",
  model: "google/gemini-2.5-flash",
  cache_hit: false,
  latency_ms: 4200,
  items: [item()],
  ...over,
});

describe("parseScanResponse", () => {
  it("returns null for anything that is not a scan response", () => {
    expect(parseScanResponse(null)).toBeNull();
    expect(parseScanResponse({})).toBeNull();
    expect(parseScanResponse({ estimated: false, items: [] })).toBeNull();
    expect(parseScanResponse({ estimated: true, items: "x" })).toBeNull();
  });

  it("round-trips a well-formed response", () => {
    const r = parseScanResponse(response());
    expect(r?.items).toHaveLength(1);
    expect(r?.items[0].selected_food_id).toBe("f1");
    expect(r?.items[0].needs_user_choice).toBe(false);
    expect(r?.low_confidence).toBe(false);
    expect(r?.items[0].preview?.kcal).toBe(247.5);
  });

  it("drops malformed items instead of failing the scan", () => {
    const r = parseScanResponse(response({ items: [item(), { id: "bad" }, item({ grams: "abc" }), item({ grams: 0 })] }));
    expect(r?.items).toHaveLength(1);
  });

  it("treats a selection that matches no candidate as needing a choice", () => {
    const r = parseScanResponse(response({ items: [item({ selected_food_id: "ghost" })] }));
    expect(r?.items[0].needs_user_choice).toBe(true);
    expect(r?.low_confidence).toBe(true);
  });

  it("forces low_confidence when overall is under 0.5 even if the server said otherwise", () => {
    const r = parseScanResponse(response({ overall_confidence: 0.3, low_confidence: false }));
    expect(r?.low_confidence).toBe(true);
  });

  it("clamps confidences and defaults missing numbers", () => {
    const r = parseScanResponse(response({ overall_confidence: 7, latency_ms: "slow", items: [item({ identification_confidence: 2, portion_confidence: -1, grams_low: undefined })] }));
    expect(r?.overall_confidence).toBe(1);
    expect(r?.latency_ms).toBe(0);
    expect(r?.items[0].identification_confidence).toBe(1);
    expect(r?.items[0].portion_confidence).toBe(0);
    expect(r?.items[0].grams_low).toBe(150);
  });

  it("keeps a not-food response with zero items", () => {
    const r = parseScanResponse(response({ not_food: true, items: [], overall_confidence: 0 }));
    expect(r?.not_food).toBe(true);
    expect(r?.items).toEqual([]);
  });

  it("filters candidates without an id or name", () => {
    const r = parseScanResponse(response({ items: [item({ candidates: [candidate(), { name: "x" }, { food_id: "f2" }] })] }));
    expect(r?.items[0].candidates).toHaveLength(1);
  });
});

describe("confidenceTier", () => {
  it("maps identification confidence to the three label tiers", () => {
    expect(confidenceTier({ identification_confidence: 0.9, needs_user_choice: false })).toBe("solid");
    expect(confidenceTier({ identification_confidence: 0.75, needs_user_choice: false })).toBe("solid");
    expect(confidenceTier({ identification_confidence: 0.6, needs_user_choice: false })).toBe("estimated");
    expect(confidenceTier({ identification_confidence: 0.4, needs_user_choice: false })).toBe("check");
    expect(confidenceTier({ identification_confidence: 0.95, needs_user_choice: true })).toBe("check");
  });
});
