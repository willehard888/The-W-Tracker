// nutrition-lookup — Premium-only barcode + explicit online text lookup.
// Local catalog first (search_foods), then Open Food Facts and USDA Branded;
// usable hits are ingested once (ingest_foods, service role) and the caller
// always gets search_foods rows back, so the client sees ONE shape whether
// the food was cached or just fetched. Never creates a food from nothing,
// never invents a nutrient value; unknown barcodes are remembered for 7 days
// so a re-scan does not hit the (shared per-IP) OFF rate limit again.
// The daily quota (bump_ai_usage) is charged only when an upstream is actually
// asked: invalid codes, local catalog hits and cached misses are free.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { missCacheFresh, missOutcome, usdaBarcodeQuery, type UpstreamStatus } from "./decide.ts";
import {
  buildNutrientMaps,
  type IngestFood,
  mapOffProduct,
  mapUsdaFood,
  normalizeBarcode,
  type NutrientDef,
  type NutrientMaps,
  type OffProduct,
  type UsdaFood,
} from "./map.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_LIMIT = 300;
const UPSTREAM_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 2_000;
const MAX_INGEST = 40;
const OFF_FIELDS =
  "code,product_name,product_name_fi,product_name_en,brands,countries_tags,quantity,product_quantity,product_quantity_unit,serving_size,serving_quantity,nutrition_data_per,nutriments,image_front_small_url,last_modified_t";

type Db = SupabaseClient;

interface SearchFoodRow {
  id: string;
  kind: string;
  name: string;
  brand: string | null;
  source: string;
  country: string | null;
  data_quality: number;
  default_serving_label: string | null;
  default_serving_grams: number | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_favorite: boolean;
  use_count: number;
  rank: number;
}

interface LookupResponse {
  found: boolean;
  cached?: boolean;
  reason?: string;
  foods: SearchFoodRow[];
  upstream: { off: UpstreamStatus; usda: UpstreamStatus; ingested?: { off: number; usda: number } };
}

interface Ctx {
  user: Db;
  service: Db;
  maps: NutrientMaps;
  country: string;
}

interface Pulled {
  foods: IngestFood[];
  status: UpstreamStatus;
}

class RateLimited extends Error {}
class LimitReached extends Error {}

/** One quota tick per upstream round-trip; throws LimitReached (→ 429) when today's allowance is spent. */
async function charge(user: Db): Promise<void> {
  const { data: allowed } = await user.rpc("bump_ai_usage", { p_limit: DAILY_LIMIT, p_kind: "nutrition_lookup" });
  if (allowed === false) throw new LimitReached();
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });

const rateLimitedResponse = () =>
  json({ error: "upstream_rate_limited", retryable: true }, 503, { "Retry-After": "30" });

const offHeaders = (): Record<string, string> => ({
  "User-Agent": Deno.env.get("OFF_USER_AGENT") ?? "WhealthFactory/1.0 (contact: app)",
  Accept: "application/json",
});

/** GET JSON with an 8 s budget. 404 → null. 429/503 → one 2 s retry, then RateLimited. */
async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    if (res.status === 429 || res.status === 503) {
      await res.body?.cancel();
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw new RateLimited(`upstream ${res.status} for ${url}`);
    }
    if (res.status === 404) {
      await res.body?.cancel();
      return null;
    }
    if (!res.ok) throw new Error(`upstream ${res.status} for ${url}`);
    return (await res.json()) as T;
  }
}

/** Runs one upstream fetch+map and folds every failure into a status — never throws. */
async function pull(fetcher: () => Promise<IngestFood[]>): Promise<Pulled> {
  try {
    const foods = await fetcher();
    return { foods, status: foods.length ? "hit" : "miss" };
  } catch (e) {
    console.warn("nutrition-lookup upstream failed:", e instanceof Error ? e.message : e);
    return { foods: [], status: e instanceof RateLimited ? "rate_limited" : "error" };
  }
}

const usdaSearchUrl = (query: string, pageSize: number, page: number, key: string) =>
  `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&dataType=Branded&pageSize=${pageSize}&pageNumber=${page}&api_key=${encodeURIComponent(key)}`;

async function searchFoods(
  user: Db,
  args: { p_query: string | null; p_limit: number; p_country: string; p_barcode: string | null },
): Promise<SearchFoodRow[]> {
  const { data, error } = await user.rpc("search_foods", args);
  if (error) throw new Error(`search_foods: ${error.message}`);
  return (data ?? []) as SearchFoodRow[];
}

async function ingest(service: Db, foods: IngestFood[]): Promise<void> {
  if (!foods.length) return;
  // ingest_foods is set-based: the same (source, source_id) twice in one call is a Postgres error.
  const unique = [...new Map(foods.map((f) => [`${f.source}:${f.source_id}`, f])).values()].slice(0, MAX_INGEST);
  const { error } = await service.rpc("ingest_foods", { p_foods: unique });
  if (error) throw new Error(`ingest_foods: ${error.message}`);
}

async function lookupBarcode(ctx: Ctx, raw: string): Promise<Response> {
  const { user, service, maps, country } = ctx;
  const skipped = { off: "skipped", usda: "skipped" } as const;

  const code = normalizeBarcode(raw);
  if (!code) return json({ found: false, reason: "invalid", foods: [], upstream: skipped } satisfies LookupResponse);
  const byBarcode = () => searchFoods(user, { p_query: null, p_limit: 1, p_country: country, p_barcode: code });

  const local = await byBarcode();
  if (local.length) return json({ found: true, foods: local, upstream: skipped } satisfies LookupResponse);

  const usdaKey = Deno.env.get("USDA_FDC_API_KEY");
  const { data: miss } = await service
    .from("food_barcode_misses")
    .select("checked_at, sources_checked, attempts")
    .eq("barcode", code)
    .maybeSingle();
  const missRow = miss as { checked_at: string; sources_checked: string[]; attempts: number } | null;
  if (missCacheFresh(missRow, usdaKey ? ["off", "usda"] : ["off"])) {
    return json({ found: false, cached: true, foods: [], upstream: skipped } satisfies LookupResponse);
  }

  await charge(user);
  const off = await pull(async () => {
    const res = await fetchJson<{ status?: number; product?: OffProduct }>(
      `https://world.openfoodfacts.org/api/v2/product/${code}?fields=${OFF_FIELDS}`,
      offHeaders(),
    );
    const food = res?.status === 1 && res.product ? mapOffProduct(res.product, maps, code) : null;
    return food ? [food] : [];
  });

  // USDA runs even when OFF throttled us — a different host, a different quota.
  let usda: Pulled = { foods: [], status: "skipped" };
  if (!off.foods.length && usdaKey) {
    usda = await pull(async () => {
      const res = await fetchJson<{ foods?: UsdaFood[] }>(usdaSearchUrl(usdaBarcodeQuery(code), 5, 1, usdaKey), {});
      const hit = res?.foods?.find((f) => normalizeBarcode(f.gtinUpc) === code);
      const food = hit ? mapUsdaFood(hit, maps) : null;
      return food ? [food] : [];
    });
  }

  const upstream = { off: off.status, usda: usda.status };
  const found = off.foods[0] ?? usda.foods[0];
  if (found) {
    await ingest(service, [found]);
    const rows = await byBarcode();
    return json({ found: rows.length > 0, foods: rows, upstream } satisfies LookupResponse);
  }

  const outcome = missOutcome(upstream);
  if (outcome.kind === "rate_limited") return rateLimitedResponse();
  // Remember a definitive miss (a timeout or a missing key is not one). This
  // attempt's sources only — a stale union would silence a source that never answered.
  if (outcome.sources_checked.length) {
    const { error } = await service.from("food_barcode_misses").upsert(
      { barcode: code, checked_at: new Date().toISOString(), sources_checked: outcome.sources_checked, attempts: (missRow?.attempts ?? 0) + 1 },
      { onConflict: "barcode" },
    );
    if (error) console.warn("food_barcode_misses upsert failed:", error.message);
  }
  return json({ found: false, foods: [], upstream } satisfies LookupResponse);
}

async function searchOnline(ctx: Ctx, q: string, page: number): Promise<Response> {
  const { user, service, maps, country } = ctx;
  const usdaKey = Deno.env.get("USDA_FDC_API_KEY");

  await charge(user);
  const [off, usda] = await Promise.all([
    pull(async () => {
      const res = await fetchJson<{ hits?: OffProduct[] }>(
        `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&langs=fi,en&page_size=20&page=${page}&fields=${OFF_FIELDS}`,
        offHeaders(),
      );
      return (res?.hits ?? []).map((h) => mapOffProduct(h, maps)).filter((f): f is IngestFood => f !== null);
    }),
    usdaKey
      ? pull(async () => {
        const res = await fetchJson<{ foods?: UsdaFood[] }>(usdaSearchUrl(q, 20, page, usdaKey), {});
        return (res?.foods ?? []).map((f) => mapUsdaFood(f, maps)).filter((f): f is IngestFood => f !== null);
      })
      : Promise.resolve<Pulled>({ foods: [], status: "skipped" }),
  ]);
  if (off.status === "rate_limited") return rateLimitedResponse();

  await ingest(service, [...off.foods, ...usda.foods]);
  const rows = await searchFoods(user, { p_query: q, p_limit: 25, p_country: country, p_barcode: null });
  return json({
    found: rows.length > 0,
    foods: rows,
    upstream: { off: off.status, usda: usda.status, ingested: { off: off.foods.length, usda: usda.foods.length } },
  } satisfies LookupResponse);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    // Service role ONLY for ingest_foods and food_barcode_misses; every other read goes through `user` so RLS applies.
    const service = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData } = await user.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { data: access, error: accessErr } = await user.rpc("has_active_access", { _user_id: userId });
    if (accessErr || !access) return json({ error: "Active membership required" }, 403);

    const body = (await req.json().catch(() => ({}))) as { barcode?: unknown; q?: unknown; page?: unknown; country?: unknown };
    const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
    const q = typeof body.q === "string" ? body.q.trim().slice(0, 100) : "";
    const page = typeof body.page === "number" && Number.isInteger(body.page) && body.page >= 1 ? Math.min(body.page, 5) : 1;
    const country = typeof body.country === "string" && /^[A-Za-z]{2}$/.test(body.country) ? body.country.toUpperCase() : "FI";
    if (!barcode && q.length < 2) return json({ error: "barcode or q (>= 2 chars) required" }, 400);

    const { data: defs, error: defsErr } = await user
      .from("nutrient_definitions")
      .select("id, key, unit, off_key, off_factor, usda_nutrient_id, usda_factor");
    if (defsErr) throw new Error(`nutrient_definitions: ${defsErr.message}`);
    const maps = buildNutrientMaps((defs ?? []) as NutrientDef[]);

    const ctx: Ctx = { user, service, maps, country };
    return barcode ? await lookupBarcode(ctx, barcode) : await searchOnline(ctx, q, page);
  } catch (e) {
    if (e instanceof LimitReached) {
      return json({ error: "You've reached today's lookup limit. It resets at midnight UTC." }, 429);
    }
    console.error("nutrition-lookup error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
