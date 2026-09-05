// Pure scanner logic lives in the edge function folder (Deno bundler needs it
// there); it has no Deno imports so vitest can test it directly.
import { describe, it, expect } from "vitest";
import {
  applyCount,
  applyLiquid,
  buildContextText,
  buildLabelToolSchema,
  buildRefineToolSchema,
  buildToolSchema,
  cleanBarcode,
  densityFor,
  GRAM_PRIORS,
  isModelNotFound,
  mapUpstreamError,
  MAX_ITEMS,
  mergePass2,
  overallConfidence,
  pickCandidate,
  sanitizeRange,
  selectForPass2,
  toCandidateFields,
  unitWeightFor,
  validateLabelArgs,
  validateRefineArgs,
  validateScanArgs,
  type Candidate,
  type EstimatedItem,
  type ValidatedItem,
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
    expect(v?.items[0]).toMatchObject({ name: "Chicken breast", estimated_grams: 150, grams_low: 120, grams_high: 180, box: null });
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

  it("v2 scene fields: enum scene_type, deduped references, plate 0 → null, flags", () => {
    const v = validateScanArgs(args([], {
      scene_type: "packaged_product", references_seen: ["fork", "fork", "plate", "hand", 7], plate_cm_estimate: 0,
      scale_confidence: 1.4, label_visible: true, second_photo_used: "yes",
    }));
    expect(v).toMatchObject({ scene_type: "packaged_product", references_seen: ["fork", "hand"], plate_cm_estimate: null, scale_confidence: 1, label_visible: true, second_photo_used: false });
    expect(validateScanArgs(args([], { scene_type: "alien" }))?.scene_type).toBe("meal");
    expect(validateScanArgs(args([], { is_food: false }))?.scene_type).toBe("not_food");
    expect(validateScanArgs(args([], { plate_cm_estimate: 26.4 }))?.plate_cm_estimate).toBe(26);
    expect(validateScanArgs(args([], { references_seen: Array(9).fill("fork").concat(["hand", "bowl", "mug", "glass", "knife", "spoon", "bottle"]) }))?.references_seen).toHaveLength(6);
  });

  it("barcode_seen keeps digits only, at EAN/UPC/GTIN lengths", () => {
    expect(validateScanArgs(args([], { barcode_seen: "6410405123457" }))?.barcode_seen).toBe("6410405123457");
    expect(validateScanArgs(args([], { barcode_seen: "64 104 05123457" }))?.barcode_seen).toBe("6410405123457");
    expect(validateScanArgs(args([], { barcode_seen: "12345" }))?.barcode_seen).toBe("");
    expect(validateScanArgs(args([], { barcode_seen: 6410405123457 }))?.barcode_seen).toBe("");
    expect(cleanBarcode("96385074")).toBe("96385074");
  });

  it("keeps a real box and nulls a degenerate or malformed one", () => {
    const v = validateScanArgs(args([
      item({ box: { x0: 10, y0: 20, x1: 500, y1: 400 } }),
      item({ box: { x0: 500, y0: 20, x1: 500, y1: 400 } }),
      item({ box: { x0: 10, y0: 20, x1: 500 } }),
      item({ box: { x0: -5, y0: 0, x1: 2000, y1: 100.6 } }),
    ]));
    expect(v?.items.map((i) => i.box)).toEqual([{ x0: 10, y0: 20, x1: 500, y1: 400 }, null, null, { x0: 0, y0: 0, x1: 1000, y1: 101 }]);
  });
});

describe("validateRefineArgs", () => {
  it("keeps one row per in-range index, resets impossible candidate picks, clamps grams", () => {
    const rows = validateRefineArgs({
      items: [
        { index: 0, chosen_candidate_index: 5, refined_grams: 120, grams_low: 100, grams_high: 140, portion_confidence: 0.8, count: 0 },
        { index: 0, chosen_candidate_index: 0, refined_grams: 999, grams_low: 1, grams_high: 1, portion_confidence: 0, count: 0 },
        { index: 7, chosen_candidate_index: -1, refined_grams: 50, grams_low: 50, grams_high: 50, portion_confidence: 0.5, count: 0 },
        { index: 1, chosen_candidate_index: 1, refined_grams: 3000, grams_low: 5000, grams_high: 1, portion_confidence: 2, count: 2 },
        { index: "1", refined_grams: 10 },
      ],
    }, 2, [2, 3]);
    expect(rows).toEqual([
      { index: 0, chosen_candidate_index: -1, refined_grams: 120, grams_low: 100, grams_high: 140, portion_confidence: 0.8, count: null },
      { index: 1, chosen_candidate_index: 1, refined_grams: 2000, grams_low: 2000, grams_high: 2000, portion_confidence: 1, count: 2 },
    ]);
    expect(validateRefineArgs(null, 2, [])).toEqual([]);
  });
});

describe("validateLabelArgs", () => {
  const label = (over: Record<string, unknown> = {}) => ({
    product_name: "Ruisleipä", brand: "Fazer", per_basis: "100g", serving_g: 0, serving_label: "",
    kcal: 250, protein_g: 8, carbs_g: 45, sugar_g: -1, fat_g: 3, sat_fat_g: 0.5, fiber_g: -1, salt_g: 1.1,
    barcode_seen: "6410405123457", read_confidence: 0.9, ...over,
  });

  it("maps −1 to absent and keeps the printed values", () => {
    const v = validateLabelArgs(label());
    expect(v?.values).toEqual({ kcal: 250, protein_g: 8, carbs_g: 45, fat_g: 3, sat_fat_g: 0.5, salt_g: 1.1 });
    expect(v).toMatchObject({ product_name: "Ruisleipä", brand: "Fazer", per_basis: "100g", serving_g: null, kcal_mismatch: false, barcode_seen: "6410405123457" });
  });

  it("converts per-serving to per 100 g when the serving weight is printed", () => {
    const v = validateLabelArgs(label({ per_basis: "serving", serving_g: 50, kcal: 100, protein_g: 5, carbs_g: 10, fat_g: 2, sat_fat_g: -1, salt_g: -1 }));
    expect(v?.values).toEqual({ kcal: 200, protein_g: 10, carbs_g: 20, fat_g: 4 });
    expect(v?.per_basis).toBe("100g");
    expect(v?.serving_g).toBe(50);
    const w = validateLabelArgs(label({ per_basis: "serving", serving_g: 0 }));
    expect(w?.per_basis).toBe("serving");
    expect(w?.values.kcal).toBe(250);
  });

  it("flags kcal that disagree with the macros by more than 25 %", () => {
    expect(validateLabelArgs(label({ kcal: 100, protein_g: 50, carbs_g: 50, fat_g: 50 }))?.kcal_mismatch).toBe(true);
    expect(validateLabelArgs(label({ kcal: 100, protein_g: -1 }))?.kcal_mismatch).toBe(false);
  });

  it("is null when nothing was printed or the input is not an object", () => {
    expect(validateLabelArgs(label({ kcal: -1, protein_g: -1, carbs_g: -1, fat_g: -1, sat_fat_g: -1, salt_g: -1 }))).toBeNull();
    expect(validateLabelArgs("x")).toBeNull();
  });
});

const valid = (over: Partial<ValidatedItem> = {}): ValidatedItem => ({
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
  box: null,
  ...over,
});
const estimated = (over: Partial<EstimatedItem> = {}): EstimatedItem => ({ ...valid(), ml: null, density_g_per_ml: null, unit_g: null, ...over });

describe("unitWeightFor / applyCount", () => {
  it("knows pieces in Finnish and English, by whole token, and refuses the uncountable", () => {
    expect(unitWeightFor("Boiled eggs", ["egg boiled", "kananmuna"], "protein")).toBe(55);
    expect(unitWeightFor("Keitetyt munat", ["munat"], "protein")).toBe(55);
    expect(unitWeightFor("Eggplant", ["aubergine"], "vegetable")).toBeNull();
    expect(unitWeightFor("Perunamuusi", ["mashed potato"], "vegetable")).toBeNull();
    expect(unitWeightFor("Rice cakes", ["rice cake"], "snack")).toBe(9);
    expect(unitWeightFor("Karjalanpiirakka", [], "composite_dish")).toBe(55);
    expect(unitWeightFor("Beer", ["olut"], "beverage")).toBeNull();
    expect(unitWeightFor("Salmon", ["lohi"], "protein")).toBeNull();
  });

  it("blends count × piece weight with the visual estimate when they agree", () => {
    const r = applyCount(estimated({ name: "Boiled eggs", canonical_search_terms: ["egg"], count: 3 }));
    expect(r).toMatchObject({ unit_g: 55, estimated_grams: 161, grams_low: 137, grams_high: 185 });
  });

  it("keeps the visual estimate and drops the unit when count × piece weight is far off", () => {
    // The keyword table is the weaker signal (a bowl of cherry tomatoes is not 4 × 120 g).
    const r = applyCount(estimated({ name: "Boiled eggs", canonical_search_terms: ["egg"], count: 4, estimated_grams: 60, grams_low: 50, grams_high: 70 }));
    expect(r).toMatchObject({ unit_g: null, estimated_grams: 60, grams_low: 50, grams_high: 70 });
  });

  it("knows cherry tomatoes are 15 g pieces, not 120 g tomatoes", () => {
    const r = applyCount(estimated({ name: "cherry tomatoes", canonical_search_terms: ["cherry tomato", "kirsikkatomaatti"], count: 4, estimated_grams: 60, grams_low: 50, grams_high: 70 }));
    expect(r).toMatchObject({ unit_g: 15, estimated_grams: 60 });
  });

  it("leaves unknown or uncounted items alone (still reporting the unit)", () => {
    expect(applyCount(estimated({ count: 3 }))).toMatchObject({ unit_g: null, estimated_grams: 150 });
    expect(applyCount(estimated({ name: "Eggs", canonical_search_terms: ["egg"] }))).toMatchObject({ unit_g: 55, estimated_grams: 150 });
    expect(applyCount(estimated({ name: "Milk", ml: 200, density_g_per_ml: 1.03, count: 1 })).unit_g).toBeNull();
  });
});

describe("densityFor / applyLiquid", () => {
  it("knows common liquids and defaults to water", () => {
    expect(densityFor("Maito", ["milk"], "dairy")).toBe(1.03);
    expect(densityFor("Oliiviöljy", ["olive oil"], "fat_oil")).toBe(0.92);
    expect(densityFor("Coffee", ["kahvi"], "beverage")).toBe(1.0);
    expect(densityFor("Kombucha", [], "beverage")).toBeNull();
    expect(densityFor("Lohikeitto", [], "soup")).toBe(1.02);
  });

  it("reads millilitres from the gram fields and converts with the density", () => {
    const r = applyLiquid(valid({ name: "Milk", canonical_search_terms: ["milk", "maito"], category: "dairy", is_liquid: true, estimated_grams: 200, grams_low: 150, grams_high: 250 }));
    expect(r).toMatchObject({ ml: 200, density_g_per_ml: 1.03, estimated_grams: 206, grams_low: 155, grams_high: 258 });
    const w = applyLiquid(valid({ name: "Kombucha", canonical_search_terms: [], category: "beverage", is_liquid: true, estimated_grams: 300 }));
    expect(w).toMatchObject({ ml: 300, density_g_per_ml: 1, estimated_grams: 300 });
  });

  it("still clamps to the category prior and ignores solids", () => {
    expect(applyLiquid(valid({ name: "Olive oil", canonical_search_terms: ["oil"], category: "fat_oil", is_liquid: true, estimated_grams: 100 }))).toMatchObject({ ml: 100, estimated_grams: 60 });
    expect(applyLiquid(valid())).toMatchObject({ ml: null, density_g_per_ml: null, estimated_grams: 150 });
  });
});

describe("sanitizeRange", () => {
  it("widens a point estimate by the confidence-driven minimum", () => {
    expect(sanitizeRange(150, 150, 150, 0.9, "protein")).toEqual({ est: 150, low: 129, high: 171 });
  });
  it("caps an absurd range at 0.4×–2.5× and the category prior", () => {
    expect(sanitizeRange(150, 10, 2000, 0.5, "protein")).toEqual({ est: 150, low: 60, high: 375 });
    expect(sanitizeRange(5000, 1, 1, 1, "fat_oil")).toEqual({ est: 60, low: 24, high: 60 });
  });
});

const cand = (food_id: string, similarity: number, rank = similarity): Candidate => ({
  food_id,
  name: food_id,
  brand: null,
  similarity,
  rank,
  default_serving_grams: null,
  default_serving_label: null,
  is_favorite: false,
  per_100g: { kcal: 100, protein_g: 10, carbs_g: 5, fat_g: 3 },
});

describe("toCandidateFields", () => {
  const row = { id: "f1", kind: "food", name: "Ruisleipä", brand: "Fazer", rank: 0.42, match_score: 0.77, default_serving_grams: 30, default_serving_label: "1 slice", is_favorite: true, kcal: 250, protein_g: 8, carbs_g: 45, fat_g: 3 };
  it("reads match_score as similarity and keeps rank and serving fields", () => {
    expect(toCandidateFields(row)).toEqual({
      food_id: "f1", name: "Ruisleipä", brand: "Fazer", similarity: 0.77, rank: 0.42, default_serving_grams: 30, default_serving_label: "1 slice", is_favorite: true,
      per_100g: { kcal: 250, protein_g: 8, carbs_g: 45, fat_g: 3 },
    });
  });
  it("falls back to min(1, rank) without match_score and skips recipes", () => {
    expect(toCandidateFields({ ...row, match_score: undefined })?.similarity).toBe(0.42);
    expect(toCandidateFields({ ...row, match_score: undefined, rank: 3.2 })?.similarity).toBe(1);
    expect(toCandidateFields({ ...row, kind: "recipe" })).toBeNull();
    expect(toCandidateFields({ name: "x" })).toBeNull();
  });
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

  it("dedupes by food_id keeping the max rank and sorts by rank", () => {
    const r = pickCandidate([cand("a", 0.3), cand("b", 0.5), cand("a", 0.9)], 0.95);
    expect(r.candidates.map((c) => [c.food_id, c.similarity])).toEqual([["a", 0.9], ["b", 0.5]]);
    expect(r.selected?.food_id).toBe("a");
  });

  it("orders by rank but decides on similarity", () => {
    const r = pickCandidate([cand("b", 0.9, 0.5), cand("a", 0.3, 0.9)], 0.95);
    expect(r.candidates.map((c) => c.food_id)).toEqual(["a", "b"]);
    expect(r.needs_user_choice).toBe(true);
    expect(pickCandidate([cand("a", 0.8, 0.9), cand("b", 0.5, 0.5)], 0.95).selected?.food_id).toBe("a");
  });

  it("empty candidates → choice with null", () => {
    expect(pickCandidate([], 0.99)).toEqual({ selected: null, needs_user_choice: true, candidates: [] });
  });
});

describe("selectForPass2", () => {
  const p2 = (portion: number, over: Partial<Parameters<typeof selectForPass2>[0][number]> = {}) => ({
    portion_confidence: portion, identification_confidence: 0.9, needs_user_choice: false, candidates: [] as Candidate[], ...over,
  });

  it("takes shaky portions and well-identified ambiguities, lowest portion first", () => {
    const picked = selectForPass2([
      p2(0.9),
      p2(0.59),
      p2(0.6),
      p2(0.8, { needs_user_choice: true, identification_confidence: 0.8, candidates: [cand("a", 0.5), cand("b", 0.4)] }),
      p2(0.8, { needs_user_choice: true, identification_confidence: 0.8, candidates: [cand("a", 0.5), cand("b", 0.2)] }),
      p2(0.8, { needs_user_choice: true, identification_confidence: 0.6, candidates: [cand("a", 0.5), cand("b", 0.4)] }),
    ]);
    expect(picked).toEqual([1, 3]);
  });

  it("caps at four", () => {
    expect(selectForPass2([p2(0.5), p2(0.1), p2(0.4), p2(0.2), p2(0.3), p2(0.9)])).toEqual([1, 3, 4, 2]);
  });
});

describe("mergePass2", () => {
  const base = () => ({
    category: "fat_oil" as const, grams: 10, grams_low: 8, grams_high: 12, ml: null, density_g_per_ml: null, count: null, portion_confidence: 0.3,
    candidates: [cand("a", 0.2), cand("b", 0.5)], selected_food_id: null, needs_user_choice: true, pass2: false,
  });
  const row = (over: Partial<ReturnType<typeof validateRefineArgs>[number]> = {}) => ({
    index: 0, chosen_candidate_index: -1, refined_grams: 5000, grams_low: 1, grams_high: 9000, portion_confidence: 0.9, count: null, ...over,
  });

  it("clamps refined grams into the category prior and marks pass2", () => {
    const [m] = mergePass2([base()], [row()]);
    expect(m).toMatchObject({ grams: 60, grams_low: 2, grams_high: 60, portion_confidence: 0.9, pass2: true, selected_food_id: null, needs_user_choice: true });
  });

  it("rejects a low-match candidate pick and accepts a credible one", () => {
    expect(mergePass2([base()], [row({ chosen_candidate_index: 0 })])[0]).toMatchObject({ selected_food_id: null, needs_user_choice: true });
    expect(mergePass2([base()], [row({ chosen_candidate_index: 1 })])[0]).toMatchObject({ selected_food_id: "b", needs_user_choice: false });
  });

  it("converts liquids through their density, keeps the count, and leaves other items untouched", () => {
    const items = [base(), { ...base(), category: "dairy" as const, grams: 206, ml: 200, density_g_per_ml: 1.03 }];
    const out = mergePass2(items, [row({ index: 1, refined_grams: 250, grams_low: 200, grams_high: 300, count: 2 })]);
    expect(out[1]).toMatchObject({ grams: 258, ml: 250, grams_low: 206, grams_high: 309, count: 2, pass2: true });
    expect(out[0]).toEqual(base());
    expect(items[1].pass2).toBe(false);
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

describe("mapUpstreamError / isModelNotFound", () => {
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

  it("recognises OpenRouter's unknown-model bodies only", () => {
    expect(isModelNotFound(404, '{"error":{"message":"No endpoints found for google/gemini-3-flash-preview","code":404}}')).toBe(true);
    expect(isModelNotFound(400, "model google/x is not a valid model ID")).toBe(true);
    expect(isModelNotFound(400, "reasoning is not supported by this model")).toBe(false);
    expect(isModelNotFound(500, "model not found")).toBe(false);
  });
});

describe("buildContextText", () => {
  it("is the plain instruction when there is nothing to add", () => {
    expect(buildContextText({ priors: [], two_photos: false })).toBe("Identify the food.");
  });

  it("adds the hint, the slot/time/plate facts and the second-photo rule", () => {
    const t = buildContextText({ hint: "lohta", slot: "lunch", local_time: "12:30", plate_cm: 30, priors: [], two_photos: true });
    expect(t).toContain("User note: «lohta»");
    expect(t).toContain("Meal: lunch · Local time: 12:30 · User's dinner plate: 30 cm");
    expect(t).toContain("photo 2");
    expect(t).not.toContain("Usual portions");
  });

  it("lists at most 20 priors as portion hints", () => {
    const priors = Array.from({ length: 25 }, (_, i) => ({ food_id: `f${i}`, name: `food ${i}`, median_g: 100 + i, n: 3 }));
    const t = buildContextText({ priors, two_photos: false });
    expect(t).toContain("portion hints only");
    expect(t.match(/≈/g)).toHaveLength(20);
  });
});

// ---------- schemas ----------

const walk = (node: unknown, visit: (n: Record<string, unknown>, path: string) => void, path = "schema") => {
  if (Array.isArray(node)) return node.forEach((n, i) => walk(n, visit, `${path}[${i}]`));
  if (typeof node !== "object" || node === null) return;
  const rec = node as Record<string, unknown>;
  visit(rec, path);
  Object.entries(rec).forEach(([k, v]) => walk(v, visit, `${path}.${k}`));
};
const propertyNames = (schema: unknown) => {
  const names: string[] = [];
  walk(schema, (n) => {
    if (n.type === "object" && typeof n.properties === "object" && n.properties) names.push(...Object.keys(n.properties as object));
  });
  return names;
};
/** Gemini's proven rules: no type unions, no nullable/anyOf/oneOf, every object additionalProperties:false with ALL properties required. */
const expectGeminiSafe = (schema: unknown, objects: number) => {
  let seen = 0;
  walk(schema, (n, path) => {
    for (const k of ["nullable", "anyOf", "oneOf", "allOf"]) expect(k in n, `${path} uses ${k}`).toBe(false);
    if (Array.isArray(n.type)) throw new Error(`${path} uses a type union`);
    if (n.enum) expect(n.type, `${path} enum must be on a string`).toBe("string");
    if (n.type !== "object") return;
    seen++;
    expect(n.additionalProperties, `${path} additionalProperties`).toBe(false);
    expect([...(n.required as string[])].sort()).toEqual(Object.keys(n.properties as object).sort());
  });
  expect(seen).toBe(objects);
};

describe("tool schemas", () => {
  it("pass 1 has no nutrient field anywhere and is Gemini-safe", () => {
    const names = propertyNames(buildToolSchema());
    expect(names.length).toBeGreaterThan(0);
    for (const k of names) expect(k).not.toMatch(/kcal|protein|carb|fat|nutrient|calorie|energy|sugar|salt|fiber/i);
    expectGeminiSafe(buildToolSchema(), 3);
    expect(buildToolSchema().function.name).toBe("report_food_items");
  });

  it("refine has no nutrient field and is Gemini-safe", () => {
    for (const k of propertyNames(buildRefineToolSchema())) expect(k).not.toMatch(/kcal|protein|carb|fat|nutrient|calorie|energy|sugar|salt|fiber/i);
    expectGeminiSafe(buildRefineToolSchema(), 2);
    expect(buildRefineToolSchema().function.name).toBe("refine_items");
  });

  it("the label transcription is the only schema with nutrient words, and uses −1 sentinels", () => {
    const names = propertyNames(buildLabelToolSchema());
    expect(names).toEqual(expect.arrayContaining(["kcal", "protein_g", "carbs_g", "sugar_g", "fat_g", "sat_fat_g", "fiber_g", "salt_g", "per_basis", "serving_g"]));
    expectGeminiSafe(buildLabelToolSchema(), 1);
    const kcal = buildLabelToolSchema().function.parameters.properties.kcal;
    expect(kcal.minimum).toBeUndefined(); // ranges are stripped for Google; the −1 sentinel is enforced by validateLabelArgs
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

describe("schemas — Google AI Studio compatibility (bisected in prod 2026-09-05)", () => {
  it("no schema carries minimum/maximum (Google answers 400 INVALID_ARGUMENT)", () => {
    const offenders: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
      if (!node || typeof node !== "object") return;
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "minimum" || k === "maximum") offenders.push(`${path}.${k}`);
        walk(v, `${path}.${k}`);
      }
    };
    walk(buildToolSchema(), "pass1");
    walk(buildRefineToolSchema(), "refine");
    walk(buildLabelToolSchema(), "label");
    expect(offenders).toEqual([]);
  });
});
