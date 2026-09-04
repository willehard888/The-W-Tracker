// AI meal-photo scanner. The model IDENTIFIES and WEIGHS (forced tool call,
// schema without nutrient fields); every nutrition number comes from the
// database via search_foods / nutrition_for_grams. Template: moderate-content.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildToolSchema,
  type Candidate,
  LOW_CONFIDENCE,
  mapUpstreamError,
  overallConfidence,
  pickCandidate,
  type ScanItem,
  type ScanResponse,
  SYSTEM_PROMPT,
  validateScanArgs,
} from "./lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Pinned on purpose — NO `models:[]` fallback. A fallback model without
// forced tool-calling answers in prose, which is exactly the invalid
// response we must never parse. Upgrade path: rerun the benchmark with
// gemini-2.5-pro, switch only on ≥ 10 pt identification F1.
const MODEL = "google/gemini-2.5-flash";
const AI_TIMEOUT_MS = 18_000;
const RETRY_DEADLINE_MS = 20_000;
const TOTAL_BUDGET_MS = 40_000;
const MIN_IMAGE_BYTES = 5 * 1024;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

type Preview = ScanItem["preview"];

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function decodeDataUrl(v: string): Uint8Array | null {
  if (!v.startsWith("data:image/")) return null;
  const comma = v.indexOf(";base64,");
  if (comma < 0) return null;
  try {
    return Uint8Array.from(atob(v.slice(comma + 8)), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function sha256Hex(parts: Uint8Array[]): Promise<string> {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type UpstreamResult = { kind: "ok"; data: unknown } | { kind: "http"; status: number; text: string } | { kind: "abort" };

async function callOpenRouter(apiKey: string, body: unknown, timeoutMs: number): Promise<UpstreamResult> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: ac.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://whealthfactory.com",
        "X-Title": "Whealth Factory",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { kind: "http", status: res.status, text: await res.text().catch(() => "") };
    return { kind: "ok", data: await res.json() };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return { kind: "abort" };
    // Network failure / unparseable JSON — treat as a transient upstream 5xx.
    console.error("nutrition-scan upstream fetch failed:", e instanceof Error ? e.message : String(e));
    return { kind: "http", status: 502, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

// choices[0].message.tool_calls[0].function.arguments, narrowed from unknown.
function toolArguments(data: unknown): string | null {
  if (!isRecord(data) || !Array.isArray(data.choices)) return null;
  const choice: unknown = data.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message) || !Array.isArray(choice.message.tool_calls)) return null;
  const call: unknown = choice.message.tool_calls[0];
  if (!isRecord(call) || !isRecord(call.function) || typeof call.function.arguments !== "string") return null;
  return call.function.arguments;
}

// search_foods row → Candidate. Recipes (kind 'recipe') are the user's own
// composite entries and are not addressable by nutrition_for_grams — skipped.
function toCandidate(row: unknown): Candidate | null {
  if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string" || row.kind === "recipe") return null;
  return {
    food_id: row.id,
    name: row.name,
    brand: typeof row.brand === "string" ? row.brand : null,
    similarity: numOrNull(row.rank) ?? 0,
    per_100g: {
      kcal: numOrNull(row.kcal),
      protein_g: numOrNull(row.protein_g),
      carbs_g: numOrNull(row.carbs_g),
      fat_g: numOrNull(row.fat_g),
    },
  };
}

function toPreview(v: unknown): Preview {
  if (!isRecord(v)) return null;
  return { kcal: numOrNull(v.kcal), protein_g: numOrNull(v.protein_g), carbs_g: numOrNull(v.carbs_g), fat_g: numOrNull(v.fat_g) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return json({ error: "Unauthorized" }, 401);
    const uid = user.id;

    // ── Body ────────────────────────────────────────────────────────────
    const body: unknown = await req.json().catch(() => null);
    if (!isRecord(body)) return json({ error: "bad_request" }, 400);
    const imageB64 = typeof body.image_b64 === "string" ? body.image_b64 : "";
    const imageBytes = decodeDataUrl(imageB64);
    if (!imageBytes || imageBytes.length < MIN_IMAGE_BYTES || imageBytes.length > MAX_IMAGE_BYTES) {
      return json({ error: "bad_image" }, 400);
    }
    const hint = typeof body.hint === "string" && body.hint.trim() ? body.hint.trim().slice(0, 200) : undefined;
    const country = typeof body.country === "string" && /^[A-Za-z]{2}$/.test(body.country) ? body.country.toUpperCase() : "FI";
    const localeIn = body.locale === "fi" || body.locale === "en" ? body.locale : null;

    // ── Gates: access → paid detection → daily cap ──────────────────────
    const [accessRes, profileRes, athleteRes] = await Promise.all([
      userClient.rpc("has_active_access", { _user_id: uid }),
      userClient.from("profiles").select("is_elite, membership_credits_until").eq("id", uid).maybeSingle(),
      localeIn
        ? Promise.resolve(null)
        : userClient.from("coach_athlete_profile").select("language_pref").eq("user_id", uid).maybeSingle(),
    ]);
    if (accessRes.error || !accessRes.data) return json({ error: "Active membership required" }, 403);

    const profile = profileRes.data;
    const credits = profile?.membership_credits_until;
    const isPaid =
      profile?.is_elite === true ||
      (typeof credits === "string" && new Date(credits).getTime() > Date.now());
    const langPref: unknown = athleteRes?.data?.language_pref;
    const locale: "fi" | "en" = localeIn ?? (typeof langPref === "string" && langPref.startsWith("fi") ? "fi" : "en");

    const { data: allowed } = await userClient.rpc("bump_ai_usage", { p_limit: isPaid ? 60 : 15, p_kind: "nutrition" });
    if (allowed === false) return json({ error: "scan_limit", resets: "midnight UTC" }, 429);

    // ── Cache (server-computed key: bytes|locale|hint) ──────────────────
    const enc = new TextEncoder();
    const imageHash = await sha256Hex([imageBytes, enc.encode(`|${locale}|${hint ?? ""}`)]);
    const adminClient = createClient(supabaseUrl, supabaseService);
    const { data: cached } = await adminClient
      .from("meal_scan_cache")
      .select("result")
      .eq("user_id", uid)
      .eq("image_sha256", imageHash)
      .maybeSingle();
    if (cached && isRecord(cached.result)) {
      const ms = Date.now() - startedAt;
      console.log(JSON.stringify({ fn: "nutrition-scan", uid, ms, model: MODEL, items: null, needs_choice: null, overall: null, cache_hit: true }));
      return json({ ...cached.result, cache_hit: true, latency_ms: ms });
    }

    // ── Model call: 18 s abort, one retry on 5xx/429/abort inside 20 s,
    //    drop `reasoning` if the model rejects it, 40 s total budget. ──────
    const requestBody = (withReasoning: boolean) => ({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 2500,
      ...(withReasoning ? { reasoning: { effort: "low" } } : {}),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: hint ? `User note: «${hint}»` : "Identify the food." },
            { type: "image_url", image_url: { url: imageB64 } },
          ],
        },
      ],
      tools: [buildToolSchema()],
      tool_choice: { type: "function", function: { name: "report_food_items" } },
    });

    let upstream: unknown = null;
    let withReasoning = true;
    let retried = false;
    for (;;) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (remaining <= 0) return json({ error: "ai_timeout", retryable: true }, 504);
      const r = await callOpenRouter(OPENROUTER_API_KEY, requestBody(withReasoning), Math.min(AI_TIMEOUT_MS, remaining));
      if (r.kind === "ok") {
        upstream = r.data;
        break;
      }
      if (r.kind === "http" && r.status === 400 && withReasoning && /reasoning/i.test(r.text)) {
        withReasoning = false;
        continue;
      }
      const transient = r.kind === "abort" || r.status === 429 || r.status >= 500;
      if (transient && !retried && Date.now() - startedAt < RETRY_DEADLINE_MS) {
        retried = true;
        continue;
      }
      const mapped = mapUpstreamError(r.kind === "abort" ? "abort" : r.status);
      console.error("nutrition-scan upstream error:", r.kind === "abort" ? "abort" : `${r.status} ${r.text.slice(0, 300)}`);
      return json({ error: mapped.error, retryable: mapped.retryable }, mapped.http);
    }

    const argsText = toolArguments(upstream);
    let parsed: unknown = null;
    try {
      parsed = argsText ? JSON.parse(argsText) : null;
    } catch {
      parsed = null;
    }
    const scan = validateScanArgs(parsed);
    if (!scan) {
      const mapped = mapUpstreamError("invalid");
      console.error("nutrition-scan invalid model output");
      return json({ error: mapped.error, retryable: mapped.retryable }, mapped.http);
    }

    const finish = async (result: ScanResponse) => {
      // Cache only successful results; a duplicate insert (23505) just means
      // a concurrent scan of the same photo already stored it.
      const { error } = await adminClient
        .from("meal_scan_cache")
        .insert({ user_id: uid, image_sha256: imageHash, model: MODEL, result });
      if (error && error.code !== "23505") console.error("nutrition-scan cache write failed:", error.message);
      console.log(JSON.stringify({
        fn: "nutrition-scan",
        uid,
        ms: result.latency_ms,
        model: MODEL,
        items: result.items.length,
        needs_choice: result.items.filter((i) => i.needs_user_choice).length,
        overall: result.overall_confidence,
        cache_hit: false,
      }));
      return json(result);
    };

    if (!scan.is_food) {
      return finish({
        estimated: true,
        overall_confidence: 0,
        low_confidence: true,
        not_food: true,
        scene_notes: scan.scene_notes,
        model: MODEL,
        cache_hit: false,
        latency_ms: Date.now() - startedAt,
        items: [],
      });
    }

    // ── Post-process: candidates from the DB (user client ⇒ RLS: public +
    //    own foods), ≤ 3 terms × ≤ 12 items in ONE Promise.all. ──────────
    const lookups = await Promise.all(
      scan.items.map((it) =>
        Promise.all(
          it.canonical_search_terms.slice(0, 3).map((term) =>
            userClient.rpc("search_foods", { p_query: term, p_limit: 3, p_country: country, p_barcode: null }),
          ),
        ),
      ),
    );

    const picked = scan.items.map((it, i) => {
      const results = lookups[i];
      if (results.some((r) => r.error)) return pickCandidate([], 0); // degrade this item only
      const rows: unknown[] = results.flatMap((r) => (Array.isArray(r.data) ? r.data : []));
      const cands = rows.map(toCandidate).filter((c): c is Candidate => c !== null);
      return pickCandidate(cands, it.identification_confidence);
    });

    const previews = await Promise.all(
      picked.map(async (p, i): Promise<Preview> => {
        if (!p.selected) return null;
        const { data, error } = await userClient.rpc("nutrition_for_grams", {
          p_food_id: p.selected.food_id,
          p_grams: scan.items[i].estimated_grams,
        });
        return error ? null : toPreview(data);
      }),
    );

    const items: ScanItem[] = scan.items.map((it, i) => ({
      id: crypto.randomUUID(),
      name: it.name,
      category: it.category,
      preparation: it.preparation,
      grams: it.estimated_grams,
      grams_low: it.grams_low,
      grams_high: it.grams_high,
      count: it.count,
      is_liquid: it.is_liquid,
      identification_confidence: it.identification_confidence,
      portion_confidence: it.portion_confidence,
      needs_user_choice: picked[i].needs_user_choice,
      selected_food_id: picked[i].selected?.food_id ?? null,
      candidates: picked[i].candidates,
      preview: previews[i],
    }));

    const overall = overallConfidence(items);
    return finish({
      estimated: true,
      overall_confidence: overall,
      low_confidence: overall < LOW_CONFIDENCE || items.some((i) => i.needs_user_choice),
      not_food: false,
      scene_notes: scan.scene_notes,
      model: MODEL,
      cache_hit: false,
      latency_ms: Date.now() - startedAt,
      items,
    });
  } catch (e) {
    console.error("nutrition-scan error:", e instanceof Error ? e.message : String(e));
    return json({ error: "scan_failed" }, 500);
  }
});
