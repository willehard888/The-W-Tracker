/**
 * Client mirror of the `nutrition-scan` edge function's response.
 * KEEP IN SYNC with supabase/functions/nutrition-scan/lib.ts (ScanResponse,
 * ScanItem, Candidate) — src/ and supabase/functions/ cannot import each other.
 *
 * Everything here is an ESTIMATE by contract: the model identifies foods and
 * guesses portions; nutrition comes from the matched database rows.
 */
export interface ScanMacroPreview {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export interface ScanCandidate {
  food_id: string;
  name: string;
  brand: string | null;
  similarity: number;
  per_100g: ScanMacroPreview;
}

export interface ScanItem {
  id: string;
  name: string;
  category: string;
  preparation: string;
  grams: number;
  grams_low: number;
  grams_high: number;
  count: number | null;
  is_liquid: boolean;
  identification_confidence: number;
  portion_confidence: number;
  needs_user_choice: boolean;
  selected_food_id: string | null;
  candidates: ScanCandidate[];
  preview: ScanMacroPreview | null;
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
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

const parsePreview = (v: unknown): ScanMacroPreview | null =>
  isRecord(v)
    ? { kcal: numOrNull(v.kcal), protein_g: numOrNull(v.protein_g), carbs_g: numOrNull(v.carbs_g), fat_g: numOrNull(v.fat_g) }
    : null;

const parseCandidate = (v: unknown): ScanCandidate | null => {
  if (!isRecord(v) || typeof v.food_id !== "string" || typeof v.name !== "string") return null;
  return {
    food_id: v.food_id,
    name: v.name,
    brand: typeof v.brand === "string" ? v.brand : null,
    similarity: num(v.similarity, 0),
    per_100g: parsePreview(v.per_100g) ?? { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
  };
};

const parseItem = (v: unknown): ScanItem | null => {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.name !== "string") return null;
  const grams = num(v.grams, NaN);
  if (!Number.isFinite(grams) || grams <= 0) return null;
  const candidates = Array.isArray(v.candidates) ? v.candidates.map(parseCandidate).filter((c): c is ScanCandidate => c !== null) : [];
  const selected = typeof v.selected_food_id === "string" ? v.selected_food_id : null;
  return {
    id: v.id,
    name: v.name,
    category: str(v.category, "other"),
    preparation: str(v.preparation, "unknown"),
    grams,
    grams_low: num(v.grams_low, grams),
    grams_high: num(v.grams_high, grams),
    count: typeof v.count === "number" && Number.isInteger(v.count) ? v.count : null,
    is_liquid: v.is_liquid === true,
    identification_confidence: Math.min(1, Math.max(0, num(v.identification_confidence, 0))),
    portion_confidence: Math.min(1, Math.max(0, num(v.portion_confidence, 0))),
    // A selection that points at no candidate is treated as "needs a choice".
    needs_user_choice: v.needs_user_choice === true || selected === null || !candidates.some((c) => c.food_id === selected),
    selected_food_id: selected,
    candidates,
    preview: parsePreview(v.preview),
  };
};

/**
 * Accepts the raw JSON from `functions.invoke("nutrition-scan")` and returns a
 * typed response, or null when the payload is not a scan response at all.
 * Malformed items are dropped rather than failing the whole scan.
 */
export function parseScanResponse(raw: unknown): ScanResponse | null {
  if (!isRecord(raw) || raw.estimated !== true || !Array.isArray(raw.items)) return null;
  const items = raw.items.map(parseItem).filter((i): i is ScanItem => i !== null);
  const anyChoice = items.some((i) => i.needs_user_choice);
  const overall = Math.min(1, Math.max(0, num(raw.overall_confidence, 0)));
  return {
    estimated: true,
    overall_confidence: overall,
    low_confidence: raw.low_confidence === true || overall < 0.5 || anyChoice,
    not_food: raw.not_food === true,
    scene_notes: str(raw.scene_notes),
    model: str(raw.model),
    cache_hit: raw.cache_hit === true,
    latency_ms: num(raw.latency_ms, 0),
    items,
  };
}

/** Label tier for one detected item, driven by identification confidence. */
export type ConfidenceTier = "solid" | "estimated" | "check";
export const confidenceTier = (item: Pick<ScanItem, "identification_confidence" | "needs_user_choice">): ConfidenceTier =>
  item.needs_user_choice || item.identification_confidence < 0.5 ? "check" : item.identification_confidence < 0.75 ? "estimated" : "solid";
