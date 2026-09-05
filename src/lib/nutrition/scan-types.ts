/**
 * Client mirror of the `nutrition-scan` edge function's response.
 * KEEP IN SYNC with supabase/functions/nutrition-scan/lib.ts (ScanResponse,
 * ScanItem, Candidate, LabelRead) — src/ and supabase/functions/ cannot
 * import each other.
 *
 * Everything here is an ESTIMATE by contract: the model identifies foods and
 * guesses portions; nutrition comes from the matched database rows. The one
 * exception is `label`: numbers transcribed from a printed nutrition table,
 * shown as read and saved only through the user-food editor.
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
  /** Text match quality 0..1 — shown as "match". */
  similarity: number;
  rank: number;
  default_serving_grams: number | null;
  default_serving_label: string | null;
  per_100g: ScanMacroPreview;
}

export interface ScanBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type OnlineLookup = "hit" | "miss" | "skipped";

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
  /** Millilitres the model saw; grams = ml × density. Null for solids. */
  ml: number | null;
  density_g_per_ml: number | null;
  /** Typical weight of one piece when the item is countable. */
  unit_g: number | null;
  box: ScanBox | null;
  identification_confidence: number;
  portion_confidence: number;
  needs_user_choice: boolean;
  selected_food_id: string | null;
  candidates: ScanCandidate[];
  online_lookup: OnlineLookup;
  pass2: boolean;
  preview: ScanMacroPreview | null;
}

export const LABEL_KEYS = ["kcal", "protein_g", "carbs_g", "sugar_g", "fat_g", "sat_fat_g", "fiber_g", "salt_g"] as const;
export type LabelKey = (typeof LABEL_KEYS)[number];

export interface LabelRead {
  product_name: string;
  brand: string;
  per_basis: "100g" | "100ml" | "serving";
  serving_g: number | null;
  serving_label: string;
  /** Absent = not printed. */
  values: Partial<Record<LabelKey, number>>;
  kcal_mismatch: boolean;
  barcode_seen: string;
  read_confidence: number;
}

export interface ScanResponse {
  estimated: true;
  scan_id: string;
  scene: "meal" | "label";
  scene_type: string;
  overall_confidence: number;
  low_confidence: boolean;
  not_food: boolean;
  scene_notes: string;
  references_seen: string[];
  scale_confidence: number;
  barcode_seen: string;
  label: LabelRead | null;
  model: string;
  cache_hit: boolean;
  latency_ms: number;
  items: ScanItem[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const clamp01 = (v: unknown) => Math.min(1, Math.max(0, num(v, 0)));

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
    similarity: clamp01(v.similarity),
    rank: num(v.rank, 0),
    default_serving_grams: numOrNull(v.default_serving_grams),
    default_serving_label: typeof v.default_serving_label === "string" ? v.default_serving_label : null,
    per_100g: parsePreview(v.per_100g) ?? { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
  };
};

const parseBox = (v: unknown): ScanBox | null => {
  if (!isRecord(v)) return null;
  const b = { x0: num(v.x0, NaN), y0: num(v.y0, NaN), x1: num(v.x1, NaN), y1: num(v.y1, NaN) };
  return Number.isFinite(b.x0 + b.y0 + b.x1 + b.y1) && b.x1 > b.x0 && b.y1 > b.y0 ? b : null;
};

const parseItem = (v: unknown): ScanItem | null => {
  if (!isRecord(v) || typeof v.id !== "string" || typeof v.name !== "string") return null;
  const grams = num(v.grams, NaN);
  if (!Number.isFinite(grams) || grams <= 0) return null;
  const candidates = Array.isArray(v.candidates) ? v.candidates.map(parseCandidate).filter((c): c is ScanCandidate => c !== null) : [];
  const selected = typeof v.selected_food_id === "string" ? v.selected_food_id : null;
  const ml = numOrNull(v.ml);
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
    ml: ml != null && ml > 0 ? ml : null,
    density_g_per_ml: ml != null && ml > 0 ? (numOrNull(v.density_g_per_ml) ?? 1) : null,
    unit_g: numOrNull(v.unit_g),
    box: parseBox(v.box),
    identification_confidence: clamp01(v.identification_confidence),
    portion_confidence: clamp01(v.portion_confidence),
    // A selection that points at no candidate is treated as "needs a choice".
    needs_user_choice: v.needs_user_choice === true || selected === null || !candidates.some((c) => c.food_id === selected),
    selected_food_id: selected,
    candidates,
    online_lookup: v.online_lookup === "hit" || v.online_lookup === "miss" ? v.online_lookup : "skipped",
    pass2: v.pass2 === true,
    preview: parsePreview(v.preview),
  };
};

const parseLabel = (v: unknown): LabelRead | null => {
  if (!isRecord(v) || !isRecord(v.values)) return null;
  const values: LabelRead["values"] = {};
  for (const k of LABEL_KEYS) {
    const n = numOrNull(v.values[k]);
    if (n != null && n >= 0) values[k] = n;
  }
  if (Object.keys(values).length === 0) return null;
  return {
    product_name: str(v.product_name),
    brand: str(v.brand),
    per_basis: v.per_basis === "100ml" || v.per_basis === "serving" ? v.per_basis : "100g",
    serving_g: numOrNull(v.serving_g),
    serving_label: str(v.serving_label),
    values,
    kcal_mismatch: v.kcal_mismatch === true,
    barcode_seen: str(v.barcode_seen),
    read_confidence: clamp01(v.read_confidence),
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
  const overall = clamp01(raw.overall_confidence);
  const label = raw.scene === "label" ? parseLabel(raw.label) : null;
  return {
    estimated: true,
    scan_id: str(raw.scan_id),
    scene: label ? "label" : "meal",
    scene_type: str(raw.scene_type, "meal"),
    overall_confidence: overall,
    low_confidence: raw.low_confidence === true || overall < 0.5 || anyChoice,
    not_food: raw.not_food === true,
    scene_notes: str(raw.scene_notes),
    references_seen: Array.isArray(raw.references_seen) ? raw.references_seen.filter((r): r is string => typeof r === "string") : [],
    scale_confidence: clamp01(raw.scale_confidence),
    barcode_seen: /^\d{8,14}$/.test(str(raw.barcode_seen)) ? str(raw.barcode_seen) : "",
    label,
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
