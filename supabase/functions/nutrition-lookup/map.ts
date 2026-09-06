// Pure Open Food Facts / USDA Branded → `ingest_foods` payload mapping.
// No Deno imports on purpose: vitest exercises this file from
// src/lib/__tests__/nutrition-lookup-map.test.ts. Every number that leaves
// here came from the upstream record × a factor from nutrient_definitions —
// nothing is estimated, and an absent nutrient stays absent (never 0).

export interface NutrientDef {
  id: number;
  key: string;
  unit: string;
  off_key: string | null;
  off_factor: number | null;
  usda_nutrient_id: number | null;
  usda_factor: number | null;
}

export interface NutrientRef {
  key: string;
  factor: number;
  unit: string;
}

export interface NutrientMaps {
  byOff: Map<string, NutrientRef>;
  byUsda: Map<number, NutrientRef>;
}

export interface IngestServing {
  label: string;
  grams: number;
  source_unit: string;
  is_default: boolean;
}

export interface IngestFood {
  is_active?: boolean;
  source: "off" | "usda_branded";
  source_id: string;
  name: string;
  name_fi: string | null;
  name_en: string | null;
  brand: string | null;
  country: string | null;
  category: string | null;
  food_type: "branded";
  data_quality: 2 | 3;
  image_url: string | null;
  source_version: string;
  servings: IngestServing[];
  /** canonical nutrient key → amount per 100 g */
  nutrients: Record<string, number>;
  barcodes: string[];
}

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_fi?: string;
  product_name_en?: string;
  brands?: string | string[]; // v2 product API: "A, B"; search-a-licious: ["A", "B"]
  countries_tags?: string[];
  quantity?: string;
  product_quantity?: number | string;
  product_quantity_unit?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  nutrition_data_per?: string;
  nutriments?: Record<string, unknown>;
  image_front_small_url?: string;
  last_modified_t?: number;
}

export interface UsdaFoodNutrient {
  nutrientId?: number;
  unitName?: string;
  value?: number;
}

export interface UsdaFood {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  marketCountry?: string;
  modifiedDate?: string;
  publishedDate?: string;
  foodNutrients?: UsdaFoodNutrient[];
}

/** Canonical key of energy — the one nutrient every ingested food must carry. */
export const KCAL_KEY = "kcal";

const MAX_SERVING_G = 5000; // food_servings CHECK (0 < grams <= 5000)
const OFF_QUALITY_KEYS = ["energy-kcal", "proteins", "fat", "carbohydrates", "sugars", "saturated-fat", "salt"];
const USDA_CARBS_ID = 1005; // "Carbohydrate, by difference" — includes fibre
const USDA_FIBER_ID = 1079;
const USDA_COUNTRY: Record<string, string> = { "United States": "US" };
/** OFF country tag → ISO code, in priority order (a product sold in several wins the first). */
export const OFF_COUNTRIES: ReadonlyArray<readonly [tag: string, code: string]> = [
  ["en:finland", "FI"],
  ["en:sweden", "SE"],
  ["en:norway", "NO"],
  ["en:denmark", "DK"],
  ["en:estonia", "EE"],
];
const SERVING_RE = /(\d+(?:[.,]\d+)?)\s*(g|gr|gram|grams|ml|cl|dl|l)\b/gi;
const TO_ML: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000 };

export function buildNutrientMaps(defs: NutrientDef[]): NutrientMaps {
  const byOff = new Map<string, NutrientRef>();
  const byUsda = new Map<number, NutrientRef>();
  for (const d of defs) {
    if (d.off_key) byOff.set(d.off_key, { key: d.key, factor: d.off_factor ?? 1, unit: d.unit });
    if (d.usda_nutrient_id != null) {
      byUsda.set(d.usda_nutrient_id, { key: d.key, factor: d.usda_factor ?? 1, unit: d.unit });
    }
  }
  return { byOff, byUsda };
}

/** GS1 mod-10 check digit for a payload without its check digit (weights 3,1,3,1… from the right). */
function gs1CheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[i]) * ((body.length - i) % 2 === 1 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}
const gs1Ok = (d: string) => gs1CheckDigit(d.slice(0, -1)) === Number(d[d.length - 1]);

/**
 * Mirrors public.normalize_barcode and src/lib/nutrition/barcode.ts (three
 * mirrors, change all or none): digits only; GTIN-14 → its consumer-unit
 * GTIN-13 (indicator 9 = variable measure → null); UPC-A (12) → EAN-13 with a
 * leading 0; a 00000-padded 13 → EAN-8; mod-10 check digit must hold.
 * Anything else → null.
 */
export function normalizeBarcode(raw: string | null | undefined): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 14) {
    if (d[0] === "9" || !gs1Ok(d)) return null;
    d = d.slice(1, 13);
    d += gs1CheckDigit(d);
  }
  if (d.length === 12) d = `0${d}`;
  if (d.length === 13 && d.startsWith("00000")) d = d.slice(5);
  if (d.length !== 8 && d.length !== 13) return null;
  return gs1Ok(d) ? d : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function clip(s: string | null | undefined, max = 200): string | null {
  const t = (s ?? "").trim();
  return t ? t.slice(0, max) : null;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

// ponytail: single country column — add foods.countries[] if the app ships in Sweden
export function offCountry(tags: string[] | undefined): string | null {
  if (!tags?.length) return null;
  const set = new Set(tags);
  return OFF_COUNTRIES.find(([tag]) => set.has(tag))?.[1] ?? null;
}

/**
 * "1 slice (25 g)" → 25 g, "2 dl" → 200 ml (density 1). The LAST unit wins:
 * OFF writes the gram weight after the household unit. null when absent or
 * outside (0, MAX_SERVING_G].
 */
export function parseServingSize(s: string | null | undefined): { grams: number; unit: "g" | "ml" } | null {
  let m: RegExpMatchArray | null = null;
  for (const x of (s ?? "").matchAll(SERVING_RE)) m = x;
  if (!m) return null;
  const unit = m[2].toLowerCase();
  const grams = round4(Number(m[1].replace(",", ".")) * (TO_ML[unit] ?? 1));
  if (!(grams > 0) || grams > MAX_SERVING_G) return null;
  return { grams, unit: unit in TO_ML ? "ml" : "g" };
}

/** OFF `_100g` values (grams for every mass nutrient) with the documented fallbacks filled in. */
function offPer100g(nutriments: Record<string, unknown>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [k, v] of Object.entries(nutriments)) {
    if (!k.endsWith("_100g")) continue;
    const n = num(v);
    if (n !== null && n >= 0) out.set(k.slice(0, -"_100g".length), n);
  }
  // The dump often carries only `energy_100g`, which is kJ.
  const kj = out.get("energy-kj") ?? out.get("energy");
  if (!out.has("energy-kcal") && kj !== undefined) out.set("energy-kcal", kj / 4.184);
  const salt = out.get("salt");
  const sodium = out.get("sodium");
  if (sodium === undefined && salt !== undefined) out.set("sodium", salt / 2.5);
  if (salt === undefined && sodium !== undefined) out.set("salt", sodium * 2.5);
  return out;
}

/**
 * OFF product → ingest payload, or null when unusable (no name, no code, or
 * no per-100 g energy — e.g. `nutrition_data_per: "serving"` products OFF
 * could not derive `_100g` values for; we never scale by guess).
 */
export function mapOffProduct(p: OffProduct, maps: NutrientMaps, requestedCode?: string): IngestFood | null {
  const code = (p.code ?? requestedCode ?? "").trim();
  const nameFi = clip(p.product_name_fi);
  const nameEn = clip(p.product_name_en);
  const name = nameFi ?? clip(p.product_name) ?? nameEn;
  if (!code || !name) return null;

  const per100 = offPer100g(p.nutriments ?? {});
  const nutrients: Record<string, number> = {};
  for (const [offKey, ref] of maps.byOff) {
    const v = per100.get(offKey);
    if (v !== undefined) nutrients[ref.key] = round4(v * ref.factor);
  }
  if (nutrients[KCAL_KEY] === undefined) return null;

  const sq = num(p.serving_quantity);
  const sv = sq !== null && sq > 0 && sq <= MAX_SERVING_G ? { grams: sq, unit: "g" } : parseServingSize(p.serving_size);
  const ml = sv?.unit === "ml" || (p.serving_quantity_unit ?? "").trim().toLowerCase() === "ml";
  const servings: IngestServing[] = sv
    ? [{
      label: clip(p.serving_size, 80) ?? `1 serving (${sv.grams} ${ml ? "ml" : "g"})`,
      grams: sv.grams,
      source_unit: ml ? "ml" : "serving",
      is_default: true,
    }]
    : [];

  const barcode = normalizeBarcode(code);
  return {
    source: "off",
    source_id: code,
    name,
    name_fi: nameFi,
    // search_text is built from name_fi/name_en/brand: a product with only the
    // main-language `product_name` still has to land in one of them.
    name_en: nameEn ?? (nameFi ? null : name),
    brand: clip((Array.isArray(p.brands) ? p.brands : p.brands?.split(","))?.[0], 120),
    country: offCountry(p.countries_tags),
    category: null,
    food_type: "branded",
    data_quality: OFF_QUALITY_KEYS.every((k) => per100.has(k)) ? 2 : 3,
    image_url: clip(p.image_front_small_url, 500),
    source_version: p.last_modified_t != null ? String(p.last_modified_t) : "",
    servings,
    nutrients,
    barcodes: barcode ? [barcode] : [],
  };
}

/** USDA Branded search hit (values per 100 g) → ingest payload, or null when unusable. */
export function mapUsdaFood(f: UsdaFood, maps: NutrientMaps): IngestFood | null {
  const name = clip(f.description);
  if (f.fdcId == null || !name) return null;

  const nutrients: Record<string, number> = {};
  for (const n of f.foodNutrients ?? []) {
    const ref = n.nutrientId != null ? maps.byUsda.get(n.nutrientId) : undefined;
    const v = num(n.value);
    if (!ref || v === null || v < 0) continue;
    // factor 1 promises "source unit == canonical unit"; a mismatch (kJ under
    // 1008, IU under a µg id) is dropped rather than converted by guess.
    const unit = (n.unitName ?? "").replace(/[µμ]/g, "u").toUpperCase();
    if (ref.factor === 1 && unit && unit !== ref.unit.toUpperCase()) continue;
    nutrients[ref.key] = round4(v * ref.factor);
  }
  if (nutrients[KCAL_KEY] === undefined) return null;

  // 1005 includes fibre; the canonical carbs_g is available carbohydrate.
  const carbsKey = maps.byUsda.get(USDA_CARBS_ID)?.key;
  const fiberKey = maps.byUsda.get(USDA_FIBER_ID)?.key;
  if (carbsKey && fiberKey && nutrients[carbsKey] !== undefined && nutrients[fiberKey] !== undefined) {
    nutrients[carbsKey] = round4(Math.max(0, nutrients[carbsKey] - nutrients[fiberKey]));
  }

  const unit = (f.servingSizeUnit ?? "").toUpperCase();
  const ss = num(f.servingSize);
  const servings: IngestServing[] = ss !== null && ss > 0 && ss <= MAX_SERVING_G && ["G", "GRM", "ML", "MLT"].includes(unit)
    ? [{
      label: clip(f.householdServingFullText, 80) ?? `1 serving (${ss} ${unit.startsWith("G") ? "g" : "ml"})`,
      grams: ss,
      source_unit: "serving",
      is_default: true,
    }]
    : [];

  const barcode = normalizeBarcode(f.gtinUpc);
  return {
    source: "usda_branded",
    source_id: String(f.fdcId),
    name,
    name_fi: null,
    name_en: name,
    brand: clip(f.brandOwner, 120) ?? clip(f.brandName, 120),
    country: USDA_COUNTRY[f.marketCountry ?? ""] ?? null,
    category: null,
    food_type: "branded",
    data_quality: 2,
    image_url: null,
    source_version: clip(f.modifiedDate, 40) ?? clip(f.publishedDate, 40) ?? "",
    servings,
    nutrients,
    barcodes: barcode ? [barcode] : [],
  };
}
