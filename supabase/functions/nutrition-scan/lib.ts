// Pure logic for the nutrition-scan edge function. NO Deno / supabase
// imports — vitest imports this file directly from src/lib/__tests__.

export const PROMPT_VERSION = 2;
export const DEFAULT_MODEL = "google/gemini-3-flash-preview";
export const FALLBACK_MODEL = "google/gemini-2.5-flash";
export const ID_AUTO_SELECT = 0.7;
export const SIM_AUTO_SELECT = 0.45;
export const SIM_MARGIN = 0.10;
export const LOW_CONFIDENCE = 0.5;
export const MAX_ITEMS = 12;
export const PASS2_PORTION_THRESHOLD = 0.6;
export const PASS2_MAX_ITEMS = 4;
export const ONLINE_FALLBACK_MAX = 3;
export const MATCH_MIN_FOR_MODEL_PICK = 0.3;
export const CACHE_TTL_DAYS = 30;

export const CATEGORIES = [
  "protein", "grain", "vegetable", "fruit", "dairy", "fat_oil", "sauce", "beverage",
  "soup", "bread", "snack", "dessert", "composite_dish", "supplement", "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PREPARATIONS = [
  "raw", "boiled", "steamed", "baked", "grilled", "fried", "deep_fried", "roasted",
  "smoked", "cured", "fermented", "dried", "unknown",
] as const;
export type Preparation = (typeof PREPARATIONS)[number];

export const SCENE_TYPES = ["meal", "packaged_product", "nutrition_label", "menu_or_receipt", "not_food"] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const REFERENCES = [
  "dinner_plate", "side_plate", "bowl", "fork", "knife", "spoon", "hand", "can_330ml", "bottle", "mug", "glass", "card_or_phone", "none",
] as const;
export type Reference = (typeof REFERENCES)[number];

export const LABEL_NUTRIENTS = ["kcal", "protein_g", "carbs_g", "sugar_g", "fat_g", "sat_fat_g", "fiber_g", "salt_g"] as const;
export type LabelNutrient = (typeof LABEL_NUTRIENTS)[number];

// Plausible single-portion gram window per category; the model's estimate is
// clamped into it so a hallucinated "2000 g of butter" can never reach the diary.
export const GRAM_PRIORS: Record<Category, [number, number]> = {
  protein: [15, 500],
  grain: [20, 500],
  vegetable: [10, 500],
  fruit: [10, 600],
  dairy: [10, 600],
  fat_oil: [2, 60],
  sauce: [5, 150],
  beverage: [30, 1000],
  soup: [100, 800],
  bread: [15, 300],
  snack: [5, 300],
  dessert: [10, 400],
  composite_dish: [50, 1000],
  supplement: [1, 100],
  other: [1, 2000],
};

/** Normalised image box, 0–1000 on both axes. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ValidatedItem {
  name: string;
  canonical_search_terms: string[];
  category: Category;
  preparation: Preparation;
  estimated_grams: number;
  grams_low: number;
  grams_high: number;
  portion_confidence: number;
  identification_confidence: number;
  is_liquid: boolean;
  count: number | null;
  box: Box | null;
}

export interface RawScanArgs {
  is_food: boolean;
  scene_type: SceneType;
  scene_notes: string;
  references_seen: Reference[];
  plate_cm_estimate: number | null;
  scale_confidence: number;
  barcode_seen: string;
  label_visible: boolean;
  second_photo_used: boolean;
  items: ValidatedItem[];
}

/** ValidatedItem after the liquid / count passes. */
export type EstimatedItem = ValidatedItem & { ml: number | null; density_g_per_ml: number | null; unit_g: number | null };

export interface RefineRow {
  index: number;
  chosen_candidate_index: number;
  refined_grams: number;
  grams_low: number;
  grams_high: number;
  portion_confidence: number;
  count: number | null;
}

export interface LabelRead {
  product_name: string;
  brand: string;
  /** Basis of `values` AFTER normalisation: per-serving values are converted to 100g when serving_g is known. */
  per_basis: "100g" | "100ml" | "serving";
  serving_g: number | null;
  serving_label: string;
  /** Absent key = not printed on the label. Never estimated. */
  values: Partial<Record<LabelNutrient, number>>;
  kcal_mismatch: boolean;
  barcode_seen: string;
  read_confidence: number;
}

export interface Candidate {
  food_id: string;
  name: string;
  brand: string | null;
  /** Text match quality 0..1 (search_foods.match_score; rank-derived when absent). */
  similarity: number;
  /** search_foods ordering score (favourites / use count boosts included). */
  rank: number;
  default_serving_grams: number | null;
  default_serving_label: string | null;
  is_favorite: boolean;
  per_100g: { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
}

export type OnlineLookup = "hit" | "miss" | "skipped";

export interface ScanItem {
  id: string;
  name: string;
  category: Category;
  preparation: Preparation;
  grams: number;
  grams_low: number;
  grams_high: number;
  count: number | null;
  is_liquid: boolean;
  ml: number | null;
  density_g_per_ml: number | null;
  unit_g: number | null;
  box: Box | null;
  identification_confidence: number;
  portion_confidence: number;
  needs_user_choice: boolean;
  selected_food_id: string | null;
  candidates: Candidate[];
  online_lookup: OnlineLookup;
  pass2: boolean;
  preview: { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null } | null;
}

export interface ScanResponse {
  estimated: true;
  scan_id: string;
  scene: "meal" | "label";
  scene_type: SceneType;
  overall_confidence: number;
  low_confidence: boolean;
  not_food: boolean;
  scene_notes: string;
  references_seen: Reference[];
  plate_cm_estimate: number | null;
  scale_confidence: number;
  barcode_seen: string;
  label: LabelRead | null;
  model: string;
  prompt_version: number;
  cache_hit: boolean;
  latency_ms: number;
  items: ScanItem[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp01 = (v: unknown): number => (isNum(v) ? Math.min(1, Math.max(0, v)) : 0);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;
const strMax = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function clampGrams(g: number, category: Category): number {
  const [lo, hi] = GRAM_PRIORS[category];
  return Math.min(hi, Math.max(lo, Math.min(2000, Math.max(1, g))));
}

/** Digits only, EAN-8 / UPC-A / EAN-13 / GTIN-14 lengths; anything else is "no barcode". */
export function cleanBarcode(v: unknown): string {
  const digits = typeof v === "string" ? v.replace(/\D/g, "") : "";
  return [8, 12, 13, 14].includes(digits.length) ? digits : "";
}

function parseBox(v: unknown): Box | null {
  if (!isRecord(v)) return null;
  const c = (k: string) => (isNum(v[k]) ? Math.round(Math.min(1000, Math.max(0, v[k] as number))) : NaN);
  const box = { x0: c("x0"), y0: c("y0"), x1: c("x1"), y1: c("y1") };
  if ([box.x0, box.y0, box.x1, box.y1].some((n) => !Number.isFinite(n))) return null;
  return box.x1 <= box.x0 || box.y1 <= box.y0 ? null : box;
}

// Whitelist-then-clamp: every field is rebuilt from a known-good shape, the
// model's raw object is never passed through.
export function validateScanArgs(raw: unknown): RawScanArgs | null {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return null;
  const items: ValidatedItem[] = [];
  for (const it of raw.items) {
    if (items.length >= MAX_ITEMS) break;
    if (!isRecord(it) || typeof it.name !== "string") continue;
    const name = it.name.trim().slice(0, 60);
    if (!name) continue;
    if (!isNum(it.estimated_grams)) continue;

    const category = oneOf(it.category, CATEGORIES, "other");
    const preparation = oneOf(it.preparation, PREPARATIONS, "unknown");
    const terms = (Array.isArray(it.canonical_search_terms) ? it.canonical_search_terms : [])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().slice(0, 40))
      .slice(0, 4);
    if (terms.length === 0) terms.push(name.slice(0, 40));

    const est = clampGrams(it.estimated_grams, category);
    const lowRaw = isNum(it.grams_low) ? it.grams_low : est;
    const highRaw = isNum(it.grams_high) ? it.grams_high : est;
    const low = Math.min(clampGrams(lowRaw, category), est);
    const high = Math.max(clampGrams(highRaw, category), est);

    const count = typeof it.count === "number" && Number.isInteger(it.count) && it.count >= 1 && it.count <= 50 ? it.count : null;

    items.push({
      name,
      canonical_search_terms: terms,
      category,
      preparation,
      estimated_grams: est,
      grams_low: low,
      grams_high: high,
      portion_confidence: clamp01(it.portion_confidence),
      identification_confidence: clamp01(it.identification_confidence),
      is_liquid: it.is_liquid === true,
      count,
      box: parseBox(it.box),
    });
  }
  const refs = (Array.isArray(raw.references_seen) ? raw.references_seen : [])
    .filter((r): r is Reference => typeof r === "string" && (REFERENCES as readonly string[]).includes(r));
  const plate = isNum(raw.plate_cm_estimate) ? Math.round(raw.plate_cm_estimate) : 0;
  return {
    is_food: raw.is_food === true,
    scene_type: oneOf(raw.scene_type, SCENE_TYPES, raw.is_food === true ? "meal" : "not_food"),
    scene_notes: typeof raw.scene_notes === "string" ? raw.scene_notes.slice(0, 200) : "",
    references_seen: [...new Set(refs)].slice(0, 6),
    plate_cm_estimate: plate >= 10 && plate <= 40 ? plate : null,
    scale_confidence: clamp01(raw.scale_confidence),
    barcode_seen: cleanBarcode(raw.barcode_seen),
    label_visible: raw.label_visible === true,
    second_photo_used: raw.second_photo_used === true,
    items,
  };
}

/** Pass-2 rows, one per item index at most; out-of-range indices and candidate picks are dropped / reset. */
export function validateRefineArgs(raw: unknown, itemCount: number, candCounts: number[]): RefineRow[] {
  if (!isRecord(raw) || !Array.isArray(raw.items)) return [];
  const seen = new Set<number>();
  const rows: RefineRow[] = [];
  for (const r of raw.items) {
    if (!isRecord(r) || !Number.isInteger(r.index)) continue;
    const index = r.index as number;
    if (index < 0 || index >= itemCount || seen.has(index)) continue;
    if (!isNum(r.refined_grams) || r.refined_grams < 1) continue;
    seen.add(index);
    const nCands = candCounts[index] ?? 0;
    const chosen = Number.isInteger(r.chosen_candidate_index) && (r.chosen_candidate_index as number) >= 0 && (r.chosen_candidate_index as number) < nCands
      ? (r.chosen_candidate_index as number)
      : -1;
    const grams = Math.min(2000, r.refined_grams);
    const count = typeof r.count === "number" && Number.isInteger(r.count) && r.count >= 1 && r.count <= 50 ? r.count : null;
    rows.push({
      index,
      chosen_candidate_index: chosen,
      refined_grams: grams,
      grams_low: Math.min(isNum(r.grams_low) ? r.grams_low : grams, grams),
      grams_high: Math.max(isNum(r.grams_high) ? r.grams_high : grams, grams),
      portion_confidence: clamp01(r.portion_confidence),
      count,
    });
  }
  return rows;
}

/** Label transcription: −1 = not printed → absent; per-serving → per 100 g when the serving weight is known. */
export function validateLabelArgs(raw: unknown): LabelRead | null {
  if (!isRecord(raw)) return null;
  const basisRaw = oneOf(raw.per_basis, ["100g", "100ml", "serving"] as const, "100g");
  const servingG = isNum(raw.serving_g) && raw.serving_g > 0 && raw.serving_g <= 2000 ? raw.serving_g : null;
  const factor = basisRaw === "serving" && servingG ? 100 / servingG : 1;
  const values: LabelRead["values"] = {};
  for (const k of LABEL_NUTRIENTS) {
    const v = raw[k];
    if (isNum(v) && v >= 0 && v <= 10000) values[k] = Math.round(v * factor * 100) / 100;
  }
  if (Object.keys(values).length === 0) return null;
  const kcal = values.kcal;
  const macro = values.protein_g != null && values.carbs_g != null && values.fat_g != null ? 4 * values.protein_g + 4 * values.carbs_g + 9 * values.fat_g : null;
  const top = kcal != null && macro != null ? Math.max(kcal, macro) : 0;
  return {
    product_name: strMax(raw.product_name, 80),
    brand: strMax(raw.brand, 60),
    per_basis: basisRaw === "serving" && servingG ? "100g" : basisRaw,
    serving_g: servingG,
    serving_label: strMax(raw.serving_label, 40),
    values,
    kcal_mismatch: top > 0 && Math.abs((kcal as number) - (macro as number)) > 0.25 * top,
    barcode_seen: cleanBarcode(raw.barcode_seen),
    read_confidence: clamp01(raw.read_confidence),
  };
}

// ---------- portion heuristics ----------

const haystack = (name: string, terms: string[]) => `${name} ${terms.join(" ")}`.toLowerCase();
const tokens = (hay: string) => hay.split(/[^a-zåäö]+/).filter(Boolean);
/** Whole-token match with a plural s; prefix match for keys of 4+ letters (Finnish inflection: munat, perunoita). */
const hasWord = (toks: string[], key: string) => toks.some((t) => t === key || t === `${key}s` || (key.length >= 4 && t.startsWith(key)));

// ponytail: keyword tables; a catalog density/unit column replaces them when a source provides one
const UNIT_TABLE: Array<[string[], number]> = [
  [["egg", "muna", "kananmuna"], 55],
  [["viipale", "slice", "toast"], 32],
  [["meatball", "lihapulla"], 25],
  [["banana", "banaani"], 120],
  [["apple", "omena"], 180],
  [["karjalanpiirakka"], 55],
  [["nakki"], 30],
  [["grillimakkara", "bratwurst"], 100],
  [["potato", "peruna"], 90],
  [["cherry tomato", "kirsikkatomaatti", "cocktail tomato"], 15],
  [["tomato", "tomaatti"], 120],
  [["mandarin", "mandariini", "clementine", "satsuma"], 75],
  [["kiwi"], 75],
  [["rice cake", "riisikakku"], 9],
  [["crispbread", "näkkileipä", "nakkileipa"], 12],
  [["tortilla", "wrap"], 40],
  [["sushi", "nigiri", "maki"], 30],
  [["dumpling", "gyoza", "pelmeni"], 25],
  [["cookie", "keksi", "biscuit"], 12],
  [["date", "taateli"], 8],
  [["sämpylä", "sampyla", "bread roll", "roll"], 60],
];
const NOT_COUNTABLE = /muusi|mash|pur[eé]e|soup|keitto|salad|salaatti|juice|mehu|smoothie|sauce|kastike|porridge|puuro/;

/** Typical weight of one piece, or null when the item is not a known countable. */
export function unitWeightFor(name: string, terms: string[], category: Category): number | null {
  if (category === "beverage" || category === "soup" || category === "sauce" || category === "fat_oil") return null;
  const hay = haystack(name, terms);
  if (NOT_COUNTABLE.test(hay)) return null;
  const toks = tokens(hay);
  for (const [keys, grams] of UNIT_TABLE) {
    if (keys.some((k) => (k.includes(" ") ? hay.includes(k) : hasWord(toks, k)))) return grams;
  }
  return null;
}

// ponytail: keyword tables; a catalog density/unit column replaces them when a source provides one
const DENSITY_TABLE: Array<[string[], number]> = [
  [["smoothie"], 1.05],
  [["yogurt drink", "juotava jogurtti", "drinkable"], 1.05],
  [["protein shake", "proteiinijuoma", "shake"], 1.03],
  [["cream", "kerma"], 1.0],
  [["oil", "öljy", "oljy"], 0.92],
  [["wine", "viini"], 0.99],
  [["beer", "olut"], 1.01],
  [["cola", "limu", "limonadi", "soda", "lemonade"], 1.04],
  [["juice", "mehu"], 1.04],
  [["milk", "maito"], 1.03],
  [["soup", "keitto"], 1.02],
  [["water", "vesi", "coffee", "kahvi", "tea", "tee"], 1.0],
];

/** Grams per millilitre for a liquid; null when unknown (caller falls back to water). */
export function densityFor(name: string, terms: string[], category: Category): number | null {
  const hay = haystack(name, terms);
  const toks = tokens(hay);
  for (const [keys, d] of DENSITY_TABLE) {
    if (keys.some((k) => (k.includes(" ") ? hay.includes(k) : hasWord(toks, k)))) return d;
  }
  return category === "soup" ? 1.02 : null;
}

/** The prompt makes the model report liquids in millilitres inside the gram fields; convert with density. */
export function applyLiquid(item: ValidatedItem): EstimatedItem {
  if (!item.is_liquid) return { ...item, ml: null, density_g_per_ml: null, unit_g: null };
  const density = densityFor(item.name, item.canonical_search_terms, item.category) ?? 1.0;
  const ml = Math.round(item.estimated_grams);
  const g = (v: number) => clampGrams(Math.round(v * density), item.category);
  const est = g(item.estimated_grams);
  return {
    ...item,
    ml,
    density_g_per_ml: density,
    unit_g: null,
    estimated_grams: est,
    grams_low: Math.min(g(item.grams_low), est),
    grams_high: Math.max(g(item.grams_high), est),
  };
}

/** count × typical piece weight, blended with the visual estimate when the two roughly agree. */
export function applyCount(item: EstimatedItem): EstimatedItem {
  if (item.ml != null) return item;
  const unit = unitWeightFor(item.name, item.canonical_search_terms, item.category);
  if (unit == null || item.count == null) return { ...item, unit_g: unit };
  const countG = item.count * unit;
  const visual = item.estimated_grams;
  // The keyword table is the weaker signal: when count × piece weight is far from what
  // the model saw ("cherry tomatoes" matching the 120 g tomato row), keep the visual
  // estimate and drop the unit so the UI offers no piece stepper with a wrong weight.
  const agree = Math.abs(countG - visual) / visual <= 0.5;
  if (!agree) return { ...item, unit_g: null };
  const est = clampGrams(Math.round(0.7 * countG + 0.3 * visual), item.category);
  return {
    ...item,
    unit_g: unit,
    estimated_grams: est,
    grams_low: Math.min(clampGrams(Math.round(est * 0.85), item.category), est),
    grams_high: Math.max(clampGrams(Math.round(est * 1.15), item.category), est),
  };
}

/** Honest range: at least ±(10 % + 40 %·(1 − portion_confidence)) around the estimate, never wider than 0.4×–2.5×, inside the category prior. */
export function sanitizeRange(est: number, low: number, high: number, portionConf: number, category: Category): { est: number; low: number; high: number } {
  const e = clampGrams(Math.round(est), category);
  const half = e * (0.1 + 0.4 * (1 - clamp01(portionConf)));
  let lo = Math.min(isNum(low) ? low : e, e - half);
  let hi = Math.max(isNum(high) ? high : e, e + half);
  lo = Math.max(lo, e * 0.4);
  hi = Math.min(hi, e * 2.5);
  lo = Math.min(clampGrams(Math.round(lo), category), e);
  hi = Math.max(clampGrams(Math.round(hi), category), e);
  return { est: e, low: lo, high: hi };
}

// ---------- candidates ----------

const numOrNull = (v: unknown): number | null => (isNum(v) ? v : null);

// search_foods row → Candidate. Recipes (kind 'recipe') are the user's own
// composite entries and are not addressable by nutrition_for_grams — skipped.
export function toCandidateFields(row: unknown): Candidate | null {
  if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string" || row.kind === "recipe") return null;
  const rank = numOrNull(row.rank) ?? 0;
  return {
    food_id: row.id,
    name: row.name,
    brand: typeof row.brand === "string" ? row.brand : null,
    similarity: clamp01(numOrNull(row.match_score) ?? Math.min(1, rank)),
    rank,
    default_serving_grams: numOrNull(row.default_serving_grams),
    default_serving_label: typeof row.default_serving_label === "string" ? row.default_serving_label : null,
    is_favorite: row.is_favorite === true,
    per_100g: {
      kcal: numOrNull(row.kcal),
      protein_g: numOrNull(row.protein_g),
      carbs_g: numOrNull(row.carbs_g),
      fat_g: numOrNull(row.fat_g),
    },
  };
}

export function pickCandidate(
  cands: Candidate[],
  idConf: number,
): { selected: Candidate | null; needs_user_choice: boolean; candidates: Candidate[] } {
  const best = new Map<string, Candidate>();
  for (const c of cands) {
    const prev = best.get(c.food_id);
    if (!prev || c.rank > prev.rank) best.set(c.food_id, c);
  }
  const candidates = [...best.values()].sort((a, b) => b.rank - a.rank);
  const top = candidates[0];
  const second = candidates[1];
  const auto =
    !!top &&
    idConf >= ID_AUTO_SELECT &&
    top.similarity >= SIM_AUTO_SELECT &&
    (!second || top.similarity - second.similarity >= SIM_MARGIN);
  return { selected: auto ? top : null, needs_user_choice: !auto, candidates };
}

type Pass2Input = Pick<ScanItem, "portion_confidence" | "identification_confidence" | "needs_user_choice" | "candidates">;

/** Indices worth a second look: shaky portions first, then ambiguous-but-well-identified items; at most PASS2_MAX_ITEMS. */
export function selectForPass2(items: Pass2Input[]): number[] {
  return items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => {
      const ambiguous =
        it.needs_user_choice &&
        it.identification_confidence >= ID_AUTO_SELECT &&
        it.candidates.filter((c) => c.similarity >= MATCH_MIN_FOR_MODEL_PICK).length >= 2;
      return it.portion_confidence < PASS2_PORTION_THRESHOLD || ambiguous;
    })
    .sort((a, b) => a.it.portion_confidence - b.it.portion_confidence)
    .slice(0, PASS2_MAX_ITEMS)
    .map(({ i }) => i);
}

type MergeItem = Pick<ScanItem, "category" | "grams" | "grams_low" | "grams_high" | "ml" | "density_g_per_ml" | "count" | "portion_confidence" | "candidates" | "selected_food_id" | "needs_user_choice" | "pass2">;

/** Fold validated pass-2 rows into the items: clamped grams, a candidate only when its match is credible. Non-mutating. */
export function mergePass2<T extends MergeItem>(items: T[], rows: RefineRow[]): T[] {
  const out = [...items];
  for (const r of rows) {
    const it = out[r.index];
    if (!it) continue;
    const density = it.ml != null ? (it.density_g_per_ml ?? 1) : 1;
    const g = (v: number) => clampGrams(Math.round(v * density), it.category);
    const grams = g(r.refined_grams);
    const chosen = r.chosen_candidate_index >= 0 ? it.candidates[r.chosen_candidate_index] : undefined;
    const pick = chosen && chosen.similarity >= MATCH_MIN_FOR_MODEL_PICK;
    out[r.index] = {
      ...it,
      grams,
      grams_low: Math.min(g(r.grams_low), grams),
      grams_high: Math.max(g(r.grams_high), grams),
      ml: it.ml != null ? Math.round(r.refined_grams) : null,
      count: r.count ?? it.count,
      portion_confidence: Math.max(it.portion_confidence, r.portion_confidence),
      selected_food_id: pick ? chosen.food_id : it.selected_food_id,
      needs_user_choice: pick ? false : it.needs_user_choice,
      pass2: true,
    };
  }
  return out;
}

export function overallConfidence(
  items: Array<{ identification_confidence: number; portion_confidence: number; needs_user_choice: boolean }>,
): number {
  if (items.length === 0) return 0;
  const mean = items.reduce((s, it) => s + it.identification_confidence * (0.5 + 0.5 * it.portion_confidence), 0) / items.length;
  const v = Math.round(mean * 1000) / 1000;
  return items.some((it) => it.needs_user_choice) ? Math.min(v, 0.49) : v;
}

export function mapUpstreamError(status: number | "abort" | "invalid"): { http: number; error: string; retryable: boolean } {
  if (status === "abort") return { http: 504, error: "ai_timeout", retryable: true };
  if (status === "invalid") return { http: 502, error: "invalid_ai_response", retryable: true };
  if (status === 402) return { http: 503, error: "ai_unavailable", retryable: false };
  if (status === 429) return { http: 503, error: "ai_unavailable", retryable: true };
  if (status >= 500) return { http: 503, error: "ai_unavailable", retryable: true };
  return { http: 502, error: "ai_unavailable", retryable: false };
}

/** OpenRouter's "this model id does not exist / has no endpoint" bodies (400 or 404). */
export function isModelNotFound(status: number, text: string): boolean {
  if (status !== 400 && status !== 404) return false;
  if (/no endpoints found/i.test(text)) return true;
  return /model/i.test(text) && /not found|does not exist|not exist|not a valid|invalid|unknown|unavailable/i.test(text);
}

// ---------- context ----------

export interface PriorRow {
  food_id: string;
  name: string;
  median_g: number;
  n: number;
}

export function buildContextText(ctx: {
  slot?: string;
  local_time?: string;
  plate_cm?: number;
  priors: PriorRow[];
  hint?: string;
  two_photos: boolean;
}): string {
  const lines: string[] = [];
  if (ctx.hint) lines.push(`User note: «${ctx.hint}»`);
  const facts: string[] = [];
  if (ctx.slot) facts.push(`Meal: ${ctx.slot}`);
  if (ctx.local_time) facts.push(`Local time: ${ctx.local_time}`);
  if (ctx.plate_cm) facts.push(`User's dinner plate: ${ctx.plate_cm} cm`);
  if (facts.length) lines.push(facts.join(" · "));
  const priors = ctx.priors.slice(0, 20);
  if (priors.length) {
    lines.push(
      "Usual portions for this user (portion hints only — never identification, never a reason to add unseen food): " +
        priors.map((p) => `${p.name} ≈ ${Math.round(p.median_g)} g (×${p.n})`).join("; "),
    );
  }
  if (ctx.two_photos) lines.push("Two photos of the same meal: photo 2 refines portions and confirms items; it never adds items.");
  return lines.length ? lines.join("\n") : "Identify the food.";
}

// ---------- tool schemas ----------
// Gemini rules (proven in production): no type unions, no nullable, no
// anyOf/oneOf; every object additionalProperties:false with ALL fields
// required; sentinels 0 / "" / −1; enums only on strings.

const num01 = { type: "number", minimum: 0, maximum: 1 };
const grams = { type: "number", minimum: 1, maximum: 2000 };
const coord = { type: "integer", minimum: 0, maximum: 1000 };

// Strict tool schema. Deliberately contains NO nutrient fields — the model
// identifies and weighs; the database supplies every nutrition number.

/**
 * Google AI Studio rejects `minimum`/`maximum` inside function-declaration
 * schemas with a bare 400 INVALID_ARGUMENT (bisected in prod 2026-09-05; the
 * type-union rule of 6d097406 is the same family). Ranges live in the
 * descriptions and in the validators' clamps instead.
 */
export function stripGeminiUnsupported<T>(schema: T): T {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === "minimum" || k === "maximum") continue;
      out[k] = walk(v);
    }
    return out;
  };
  return walk(schema) as T;
}

function buildToolSchemaRaw() {
  return {
    type: "function",
    function: {
      name: "report_food_items",
      description: "Report the scene and every distinct food or drink visible in the photo with a portion estimate in grams.",
      parameters: {
        type: "object",
        properties: {
          is_food: { type: "boolean", description: "false when the image shows no edible food or drink (label, menu, object, person)" },
          scene_type: { type: "string", enum: [...SCENE_TYPES] },
          scene_notes: { type: "string", maxLength: 200, description: "One sentence about the scene, references used, and any uncertainty" },
          references_seen: { type: "array", maxItems: 6, items: { type: "string", enum: [...REFERENCES] }, description: "Every size reference visible" },
          plate_cm_estimate: { type: "integer", minimum: 0, maximum: 40, description: "Estimated plate diameter in cm; 0 when no plate" },
          scale_confidence: num01,
          barcode_seen: { type: "string", maxLength: 14, description: "Digits of a readable barcode; empty string when none" },
          label_visible: { type: "boolean", description: "true when a printed nutrition table is readable" },
          second_photo_used: { type: "boolean" },
          items: {
            type: "array",
            maxItems: MAX_ITEMS,
            items: {
              type: "object",
              properties: {
                name: { type: "string", maxLength: 60, description: "Short human name of the item in the user's language" },
                canonical_search_terms: {
                  type: "array",
                  minItems: 1,
                  maxItems: 4,
                  items: { type: "string", maxLength: 40 },
                  description: "Generic database search terms, English first then Finnish, brand only if printed on packaging",
                },
                category: { type: "string", enum: [...CATEGORIES] },
                preparation: { type: "string", enum: [...PREPARATIONS] },
                estimated_grams: grams,
                grams_low: grams,
                grams_high: grams,
                portion_confidence: num01,
                identification_confidence: num01,
                is_liquid: { type: "boolean" },
                // No type unions here: Gemini rejects `type: [..., "null"]` and the whole call fails with a 400. 0 = not countable (validation maps it to null).
                count: { type: "integer", minimum: 0, maximum: 50, description: "Number of discrete pieces (eggs, slices, meatballs); 0 when not countable" },
                box: {
                  type: "object",
                  description: "Bounding box on photo 1, normalised 0-1000; x1<=x0 when unknown",
                  properties: { x0: coord, y0: coord, x1: coord, y1: coord },
                  required: ["x0", "y0", "x1", "y1"],
                  additionalProperties: false,
                },
              },
              required: [
                "name", "canonical_search_terms", "category", "preparation", "estimated_grams", "grams_low", "grams_high",
                "portion_confidence", "identification_confidence", "is_liquid", "count", "box",
              ],
              additionalProperties: false,
            },
          },
        },
        required: [
          "is_food", "scene_type", "scene_notes", "references_seen", "plate_cm_estimate", "scale_confidence", "barcode_seen",
          "label_visible", "second_photo_used", "items",
        ],
        additionalProperties: false,
      },
    },
  };
}

function buildRefineToolSchemaRaw() {
  return {
    type: "function",
    function: {
      name: "refine_items",
      description: "Second look at specific items: choose the catalog candidate and refine the portion.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            maxItems: MAX_ITEMS,
            items: {
              type: "object",
              properties: {
                index: { type: "integer", minimum: 0, maximum: MAX_ITEMS - 1 },
                chosen_candidate_index: { type: "integer", minimum: -1, maximum: 9, description: "-1 when no listed candidate is this food" },
                refined_grams: grams,
                grams_low: grams,
                grams_high: grams,
                portion_confidence: num01,
                count: { type: "integer", minimum: 0, maximum: 50, description: "0 when not countable" },
              },
              required: ["index", "chosen_candidate_index", "refined_grams", "grams_low", "grams_high", "portion_confidence", "count"],
              additionalProperties: false,
            },
          },
        },
        required: ["items"],
        additionalProperties: false,
      },
    },
  };
}

// The ONLY schema with nutrient fields: a transcription of a printed table,
// isolated from the identification path and never blended with estimates.
function buildLabelToolSchemaRaw() {
  const printed = { type: "number", minimum: -1, maximum: 10000, description: "As printed; -1 when not printed" };
  return {
    type: "function",
    function: {
      name: "report_nutrition_label",
      description: "Transcribe the printed nutrition table exactly as printed.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", maxLength: 80 },
          brand: { type: "string", maxLength: 60 },
          per_basis: { type: "string", enum: ["100g", "100ml", "serving"] },
          serving_g: { type: "number", minimum: 0, maximum: 2000, description: "Serving weight in g or ml; 0 when unknown" },
          serving_label: { type: "string", maxLength: 40 },
          kcal: printed,
          protein_g: printed,
          carbs_g: printed,
          sugar_g: printed,
          fat_g: printed,
          sat_fat_g: printed,
          fiber_g: printed,
          salt_g: printed,
          barcode_seen: { type: "string", maxLength: 14, description: "Digits of a readable barcode; empty string when none" },
          read_confidence: num01,
        },
        required: [
          "product_name", "brand", "per_basis", "serving_g", "serving_label", "kcal", "protein_g", "carbs_g", "sugar_g", "fat_g",
          "sat_fat_g", "fiber_g", "salt_g", "barcode_seen", "read_confidence",
        ],
        additionalProperties: false,
      },
    },
  };
}

// ---------- prompts ----------

export const SYSTEM_PROMPT = `You are the food identification engine of Whealth Factory, a Finnish health app. You look at a photo of a meal (optionally a second photo of the same meal) and report what is on it through the report_food_items tool. You identify and weigh; you never compute nutrition.

SCENE
- Classify scene_type first: meal, packaged_product, nutrition_label, menu_or_receipt or not_food.
- A nutrition label or a package with a readable nutrition table: set label_visible=true, is_food=false and report no items. The label is transcribed in a separate step.
- If a barcode is readable, copy its digits into barcode_seen; otherwise an empty string.

IDENTIFY
- Report every distinct food or drink as its own item (max 12). A plate of chicken, rice and salad is three items.
- Split composite meals into their visible components UNLESS it is a standard named dish that a database lists as one entry (lasagne, pizza slice, karjalanpiirakka, hamburger, sushi roll, porridge). Then report the dish as one item with category composite_dish.
- Name the preparation you can see (grilled, fried, boiled, raw, ...). Use "unknown" when it is not visible.
- canonical_search_terms: 1-4 generic database search terms for this item, English first, then Finnish (e.g. "chicken breast grilled", "broileri rintafilee grillattu"). Include a brand only when it is printed on visible packaging.
- count: the number of discrete pieces for countable items (eggs, meatballs, slices; berries are NOT countable). 0 otherwise.

REFERENCES
- List every size reference you can see in references_seen (plate, bowl, cutlery, hand, can, mug, glass, card or phone). Use "none" only when there is nothing.
- Estimate the plate diameter class in plate_cm_estimate (side plate ≈ 21 cm, dinner plate ≈ 26 cm, large plate ≈ 30 cm; 0 when there is no plate) and say how sure you are in scale_confidence.
- If the context names the user's plate size, prefer it over the 26 cm default.

ESTIMATE GRAMS
- Give estimated_grams plus an honest low-high range. Reason from visible references: dinner plate ≈ 26 cm, fork ≈ 19 cm, a hand ≈ 18 cm, 330 ml can, mug ≈ 300 ml, glass ≈ 200-250 ml.
- Typical single portions: rice or pasta side 120-250 g, chicken breast 100-200 g, salmon fillet 120-180 g, salad 60-150 g, potatoes 100-250 g, bread slice 30-40 g, glass of milk 200-250 g, sauce 20-60 g, butter or oil 5-15 g.
- Wide ranges are honest. A piled or reference-less plate deserves a wide range and a low portion_confidence.

BOXES
- box: the item's bounding box on photo 1, normalised to 0-1000 on both axes. When you cannot place it, make the box degenerate (x1 <= x0).

LIQUIDS
- is_liquid true for drinks, soups and other pourable items. For liquids report MILLILITRES in estimated_grams, grams_low and grams_high; the engine converts with the density of that liquid.

COUNTS
- count × the typical piece weight should agree with estimated_grams. When they disagree, trust the count and fix the grams.

CONTEXT
- The meal slot, local time, plate size and the user's usual portions are PORTION hints only. They never identify a food and are never a reason to add food you do not see.

SECOND PHOTO
- When a second photo is given, it refines portions and confirms items. It never adds items that are not in photo 1. Set second_photo_used accordingly.

CONFIDENCE
- identification_confidence: 0.9 or above only when the food is unmistakable; 0.5 or below when it could plausibly be something else; 0.3 or below means you are guessing - then name the item "unknown ..." and say so in scene_notes.
- portion_confidence: 0.4 or below whenever no size reference is visible.

RULES
- Never invent hidden ingredients (cooking oil, dressing, sugar, butter) unless they are visibly present.
- If the image is not food - a menu, a receipt, a person, an object, a screenshot - set is_food=false with an empty items list and explain in scene_notes.
- Never output calories, macros or any nutrition number anywhere, not even in names or notes. The database computes nutrition from your grams.
- Respond only by calling the report_food_items tool. No prose.`;

export const PASS2_PROMPT = `You already reported the items on this meal. Look again at the listed items only, at the region each box marks on photo 1 (and photo 2 when given). For each listed item: choose the catalog candidate index that IS this food, or -1 when none of them is; refine grams (millilitres for liquids) with an honest low-high range and a portion_confidence; confirm the count of pieces (0 when not countable). Never output calories, macros or any nutrition number. Respond only by calling the refine_items tool.`;

export const LABEL_PROMPT = `Transcribe the printed nutrition table in this photo exactly as printed, through the report_nutrition_label tool. Copy the numbers for the basis the table uses (per 100 g, per 100 ml, or per serving) and give the serving weight when the label prints it. Use -1 for every value that is not printed. Never estimate, complete or round a missing value. Copy a readable barcode's digits into barcode_seen. Respond only by calling the tool.`;

export function buildToolSchema() {
  return stripGeminiUnsupported(buildToolSchemaRaw());
}

export function buildRefineToolSchema() {
  return stripGeminiUnsupported(buildRefineToolSchemaRaw());
}

export function buildLabelToolSchema() {
  return stripGeminiUnsupported(buildLabelToolSchemaRaw());
}
