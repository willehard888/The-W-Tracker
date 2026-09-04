// Pure logic for the nutrition-scan edge function. NO Deno / supabase
// imports — vitest imports this file directly from src/lib/__tests__.

export const ID_AUTO_SELECT = 0.7;
export const SIM_AUTO_SELECT = 0.45;
export const SIM_MARGIN = 0.10;
export const LOW_CONFIDENCE = 0.5;
export const MAX_ITEMS = 12;

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

export interface RawScanArgs {
  is_food: boolean;
  scene_notes: string;
  items: Array<{
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
  }>;
}

export type ValidatedItem = RawScanArgs["items"][number];

export interface Candidate {
  food_id: string;
  name: string;
  brand: string | null;
  similarity: number;
  per_100g: { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
}

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
  identification_confidence: number;
  portion_confidence: number;
  needs_user_choice: boolean;
  selected_food_id: string | null;
  candidates: Candidate[];
  preview: { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null } | null;
}

export interface ScanResponse {
  estimated: true;
  overall_confidence: number;
  low_confidence: boolean;
  not_food: boolean;
  scene_notes: string;
  model: string;
  cache_hit: boolean;
  latency_ms: number;
  items: ScanItem[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const clamp01 = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback;

export function clampGrams(g: number, category: Category): number {
  const [lo, hi] = GRAM_PRIORS[category];
  return Math.min(hi, Math.max(lo, Math.min(2000, Math.max(1, g))));
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
    if (typeof it.estimated_grams !== "number" || !Number.isFinite(it.estimated_grams)) continue;

    const category = oneOf(it.category, CATEGORIES, "other");
    const preparation = oneOf(it.preparation, PREPARATIONS, "unknown");
    const terms = (Array.isArray(it.canonical_search_terms) ? it.canonical_search_terms : [])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().slice(0, 40))
      .slice(0, 4);
    if (terms.length === 0) terms.push(name.slice(0, 40));

    const est = clampGrams(it.estimated_grams, category);
    const lowRaw = typeof it.grams_low === "number" && Number.isFinite(it.grams_low) ? it.grams_low : est;
    const highRaw = typeof it.grams_high === "number" && Number.isFinite(it.grams_high) ? it.grams_high : est;
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
    });
  }
  return {
    is_food: raw.is_food === true,
    scene_notes: typeof raw.scene_notes === "string" ? raw.scene_notes.slice(0, 200) : "",
    items,
  };
}

export function pickCandidate(
  cands: Candidate[],
  idConf: number,
): { selected: Candidate | null; needs_user_choice: boolean; candidates: Candidate[] } {
  const best = new Map<string, Candidate>();
  for (const c of cands) {
    const prev = best.get(c.food_id);
    if (!prev || c.similarity > prev.similarity) best.set(c.food_id, c);
  }
  const candidates = [...best.values()].sort((a, b) => b.similarity - a.similarity);
  const top = candidates[0];
  const second = candidates[1];
  const auto =
    !!top &&
    idConf >= ID_AUTO_SELECT &&
    top.similarity >= SIM_AUTO_SELECT &&
    (!second || top.similarity - second.similarity >= SIM_MARGIN);
  return { selected: auto ? top : null, needs_user_choice: !auto, candidates };
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

// Strict tool schema. Deliberately contains NO nutrient fields — the model
// identifies and weighs; the database supplies every nutrition number.
export function buildToolSchema() {
  const num01 = { type: "number", minimum: 0, maximum: 1 };
  const grams = { type: "number", minimum: 1, maximum: 2000 };
  return {
    type: "function",
    function: {
      name: "report_food_items",
      description: "Report every distinct food or drink visible in the photo with a portion estimate in grams.",
      parameters: {
        type: "object",
        properties: {
          is_food: { type: "boolean", description: "false when the image shows no edible food or drink (label, menu, object, person)" },
          scene_notes: { type: "string", maxLength: 200, description: "One sentence about the scene, references used, and any uncertainty" },
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
              },
              required: [
                "name", "canonical_search_terms", "category", "preparation", "estimated_grams", "grams_low", "grams_high",
                "portion_confidence", "identification_confidence", "is_liquid", "count",
              ],
              additionalProperties: false,
            },
          },
        },
        required: ["is_food", "scene_notes", "items"],
        additionalProperties: false,
      },
    },
  };
}

export const SYSTEM_PROMPT = `You are the food identification engine of Whealth Factory, a Finnish health app. You look at ONE photo of a meal and report what is on it through the report_food_items tool. You identify and weigh; you never compute nutrition.

IDENTIFY
- Report every distinct food or drink as its own item (max 12). A plate of chicken, rice and salad is three items.
- Split composite meals into their visible components UNLESS it is a standard named dish that a database lists as one entry (lasagne, pizza slice, karjalanpiirakka, hamburger, sushi roll, porridge). Then report the dish as one item with category composite_dish.
- Name the preparation you can see (grilled, fried, boiled, raw, ...). Use "unknown" when it is not visible.
- canonical_search_terms: 1-4 generic database search terms for this item, English first, then Finnish (e.g. "chicken breast grilled", "broileri rintafilee grillattu"). Include a brand only when it is printed on visible packaging.
- count: the number of discrete pieces for countable items (eggs, meatballs, slices; berries are NOT countable). 0 otherwise.

ESTIMATE GRAMS
- Give estimated_grams plus an honest low-high range. Reason from visible references: dinner plate ≈ 26 cm, fork ≈ 19 cm, a hand ≈ 18 cm, 330 ml can, mug ≈ 300 ml, glass ≈ 200-250 ml.
- Typical single portions: rice or pasta side 120-250 g, chicken breast 100-200 g, salmon fillet 120-180 g, salad 60-150 g, potatoes 100-250 g, bread slice 30-40 g, glass of milk 200-250 g, sauce 20-60 g, butter or oil 5-15 g.
- Wide ranges are honest. A piled or reference-less plate deserves a wide range and a low portion_confidence.
- is_liquid true for drinks, soups and other pourable items; grams then mean millilitres at water density.

CONFIDENCE
- identification_confidence: 0.9 or above only when the food is unmistakable; 0.5 or below when it could plausibly be something else; 0.3 or below means you are guessing - then name the item "unknown ..." and say so in scene_notes.
- portion_confidence: 0.4 or below whenever no size reference is visible.

RULES
- Never invent hidden ingredients (cooking oil, dressing, sugar, butter) unless they are visibly present.
- If the image is not food - a nutrition label, a menu, a receipt, a person, an object, a screenshot - set is_food=false with an empty items list and explain in scene_notes.
- Never output calories, macros or any nutrition number anywhere, not even in names or notes. The database computes nutrition from your grams.
- Respond only by calling the report_food_items tool. No prose.`;
