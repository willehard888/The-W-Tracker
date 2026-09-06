// AI meal-photo scanner v2. The model IDENTIFIES and WEIGHS (forced tool
// call, schema without nutrient fields); every nutrition number comes from the
// database via search_foods / nutrition_for_grams. The one exception is the
// isolated label-transcription tool, whose output is shown as "read from the
// label" and saved only through the user-food editor. Template: moderate-content.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  applyCount,
  applyLiquid,
  buildContextText,
  buildLabelToolSchema,
  buildRefineToolSchema,
  buildToolSchema,
  CACHE_TTL_DAYS,
  type Candidate,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  isGenericSource,
  isModelNotFound,
  LABEL_PROMPT,
  LOW_CONFIDENCE,
  mapUpstreamError,
  mergePass2,
  ONLINE_FALLBACK_MAX,
  overallConfidence,
  PASS2_PROMPT,
  pickCandidate,
  GENERIC_BONUS_MEAL,
  GENERIC_BONUS_PACKAGED,
  type PriorRow,
  PROMPT_VERSION,
  sanitizeRange,
  type ScanItem,
  type ScanResponse,
  selectForPass2,
  SYSTEM_PROMPT,
  toCandidateFields,
  validateLabelArgs,
  validateRefineArgs,
  validateScanArgs,
} from "./lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// SCAN_MODEL overrides the default; an unknown id falls back ONCE to
// FALLBACK_MODEL (still forced tool-calling — a prose-answering fallback is
// exactly the invalid response we must never parse).
const AI_TIMEOUT_MS = 18_000;
const RETRY_DEADLINE_MS = 20_000;
const TOTAL_BUDGET_MS = 40_000;
const STAGE_TIMEOUT_MS = 12_000;
const STAGE_RESERVE_MS = 4_000;
const ONLINE_MIN_REMAINING_MS = 8_000;
const ONLINE_TIMEOUT_MS = 4_000;
const MIN_IMAGE_BYTES = 5 * 1024;
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
const SLOTS = ["breakfast", "lunch", "dinner", "snack"];

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

function toPreview(v: unknown): Preview {
  if (!isRecord(v)) return null;
  return { kcal: numOrNull(v.kcal), protein_g: numOrNull(v.protein_g), carbs_g: numOrNull(v.carbs_g), fat_g: numOrNull(v.fat_g) };
}

function parsePriors(v: unknown): PriorRow[] {
  if (!Array.isArray(v)) return [];
  const out: PriorRow[] = [];
  for (const p of v) {
    if (!isRecord(p) || typeof p.food_id !== "string" || typeof p.name !== "string") continue;
    const median = numOrNull(p.median_g);
    if (median == null || median <= 0) continue;
    out.push({ food_id: p.food_id, name: p.name.slice(0, 60), median_g: median, n: numOrNull(p.n) ?? 0 });
  }
  return out;
}

const imagePart = (url: string) => ({ type: "image_url", image_url: { url } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();
  const remaining = () => TOTAL_BUDGET_MS - (Date.now() - startedAt);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");
    let model = Deno.env.get("SCAN_MODEL") ?? DEFAULT_MODEL;

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
    const imageB64Two = typeof body.image_b64_2 === "string" && body.image_b64_2 ? body.image_b64_2 : null;
    const imageBytesTwo = imageB64Two ? decodeDataUrl(imageB64Two) : null;
    if (imageB64Two && (!imageBytesTwo || imageBytesTwo.length < MIN_IMAGE_BYTES || imageBytesTwo.length > MAX_IMAGE_BYTES)) {
      return json({ error: "bad_image" }, 400);
    }
    const hint = typeof body.hint === "string" && body.hint.trim() ? body.hint.trim().slice(0, 200) : undefined;
    const country = typeof body.country === "string" && /^[A-Za-z]{2}$/.test(body.country) ? body.country.toUpperCase() : "FI";
    const localeIn = body.locale === "fi" || body.locale === "en" ? body.locale : null;
    const slot = typeof body.slot === "string" && SLOTS.includes(body.slot) ? body.slot : undefined;
    const localTime = typeof body.local_time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.local_time) ? body.local_time : undefined;

    // ── Gates: access → paid detection → priors → daily cap ─────────────
    const [accessRes, profileRes, athleteRes, priorsRes] = await Promise.all([
      userClient.rpc("has_active_access", { _user_id: uid }),
      userClient.from("profiles").select("is_elite, membership_credits_until, nutrition_prefs").eq("id", uid).maybeSingle(),
      localeIn
        ? Promise.resolve(null)
        : userClient.from("coach_athlete_profile").select("language_pref").eq("user_id", uid).maybeSingle(),
      userClient.rpc("scan_user_priors"),
    ]);
    if (accessRes.error || !accessRes.data) return json({ error: "Active membership required" }, 403);

    const profile = profileRes.data;
    const credits = profile?.membership_credits_until;
    const isPaid =
      profile?.is_elite === true ||
      (typeof credits === "string" && new Date(credits).getTime() > Date.now());
    const langPref: unknown = athleteRes?.data?.language_pref;
    const locale: "fi" | "en" = localeIn ?? (typeof langPref === "string" && langPref.startsWith("fi") ? "fi" : "en");
    // Plate size: the request's value (just picked on the review screen) beats
    // the stored preference, which may not have landed yet.
    const prefs: unknown = profile?.nutrition_prefs;
    const validPlate = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 18 && v <= 32 ? Math.round(v) : undefined);
    const plateCm = validPlate(body.plate_cm) ?? validPlate(isRecord(prefs) ? prefs.plate_cm : undefined);
    const priors = priorsRes.error ? [] : parsePriors(priorsRes.data);

    const { data: allowed } = await userClient.rpc("bump_ai_usage", { p_limit: isPaid ? 60 : 15, p_kind: "nutrition" });
    if (allowed === false) return json({ error: "scan_limit", resets: "midnight UTC" }, 429);

    // ── Cache (server-computed key: bytes|locale|hint|slot|plate|model|prompt) ──
    const enc = new TextEncoder();
    const imageHash = await sha256Hex([
      imageBytes,
      ...(imageBytesTwo ? [imageBytesTwo] : []),
      enc.encode(`|${locale}|${hint ?? ""}|${slot ?? ""}|${plateCm ?? ""}|${model}|p${PROMPT_VERSION}`),
    ]);
    const scanId = crypto.randomUUID();
    const adminClient = createClient(supabaseUrl, supabaseService);
    const { data: cached } = await adminClient
      .from("meal_scan_cache")
      .select("id, result")
      .eq("user_id", uid)
      .eq("image_sha256", imageHash)
      .gte("created_at", new Date(Date.now() - CACHE_TTL_DAYS * 86_400_000).toISOString())
      .maybeSingle();
    if (cached && isRecord(cached.result)) {
      const ms = Date.now() - startedAt;
      console.log(JSON.stringify({ fn: "nutrition-scan", uid, ms, model, items: null, needs_choice: null, overall: null, cache_hit: true }));
      return json({ ...cached.result, scan_id: typeof cached.id === "string" ? cached.id : scanId, cache_hit: true, latency_ms: ms });
    }

    // ── Model calls: 18 s abort, no `reasoning` param (Gemini 3 answers 400 INVALID_ARGUMENT to it on forced tool calls; the prod coach functions never send it), switch once
    //    to the fallback model on "model not found", optional single retry on
    //    5xx/429/abort inside 20 s, everything inside the 40 s budget. ────
    type ToolResult = { kind: "ok"; args: unknown } | { kind: "fail"; status: number | "abort" | "invalid"; text?: string };
    const callTool = async (opts: {
      system: string;
      content: unknown[];
      tool: unknown;
      toolName: string;
      maxTokens: number;
      timeoutMs: number;
      retry: boolean;
    }): Promise<ToolResult> => {
      let retried = false;
      for (;;) {
        const left = remaining();
        if (left <= 0) return { kind: "fail", status: "abort" };
        const r = await callOpenRouter(OPENROUTER_API_KEY, {
          model,
          temperature: 0.2,
          max_tokens: opts.maxTokens,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.content },
          ],
          tools: [opts.tool],
          tool_choice: { type: "function", function: { name: opts.toolName } },
        }, Math.min(opts.timeoutMs, left));
        if (r.kind === "ok") {
          const argsText = toolArguments(r.data);
          try {
            return { kind: "ok", args: argsText ? JSON.parse(argsText) : null };
          } catch {
            return { kind: "fail", status: "invalid" };
          }
        }
        if (r.kind === "http" && model !== FALLBACK_MODEL && isModelNotFound(r.status, r.text)) {
          console.warn(`nutrition-scan model ${model} unavailable (${r.status}); falling back to ${FALLBACK_MODEL}`);
          model = FALLBACK_MODEL;
          continue;
        }
        const transient = r.kind === "abort" || r.status === 429 || r.status >= 500;
        if (opts.retry && transient && !retried && Date.now() - startedAt < RETRY_DEADLINE_MS) {
          retried = true;
          continue;
        }
        console.error(`nutrition-scan upstream error (${opts.toolName}):`, r.kind === "abort" ? "abort" : `${r.status} ${r.text.slice(0, 300)}`);
        return { kind: "fail", status: r.kind === "abort" ? "abort" : r.status, text: r.kind === "abort" ? "" : r.text.slice(0, 300) };
      }
    };
    const stageTimeout = () => Math.min(STAGE_TIMEOUT_MS, remaining() - STAGE_RESERVE_MS);
    const images = [imagePart(imageB64), ...(imageB64Two ? [{ type: "text", text: "Photo 2 of the same meal:" }, imagePart(imageB64Two)] : [])];

    // ── Pass 1: identify + weigh ────────────────────────────────────────
    const pass1 = await callTool({
      system: SYSTEM_PROMPT,
      content: [{ type: "text", text: buildContextText({ slot, local_time: localTime, plate_cm: plateCm, priors, hint, two_photos: !!imageB64Two }) }, ...images],
      tool: buildToolSchema(),
      toolName: "report_food_items",
      maxTokens: 3500,
      timeoutMs: AI_TIMEOUT_MS,
      retry: true,
    });
    if (pass1.kind === "fail") {
      const mapped = mapUpstreamError(pass1.status);
      return json({ error: mapped.error, retryable: mapped.retryable, upstream: { status: pass1.status, text: pass1.text } }, mapped.http);
    }
    const scan = validateScanArgs(pass1.args);
    if (!scan) {
      const mapped = mapUpstreamError("invalid");
      console.error("nutrition-scan invalid model output");
      return json({ error: mapped.error, retryable: mapped.retryable }, mapped.http);
    }

    const finish = async (result: ScanResponse) => {
      // Cache only successful results; a duplicate insert (23505) just means
      // a concurrent scan of the same photo already stored it.
      // TODO(eval): meal_scan_reviews (model_grams vs final_grams per item) is the ground truth for the offline eval harness — nothing built yet.
      const { error } = await adminClient
        .from("meal_scan_cache")
        .insert({ id: scanId, user_id: uid, image_sha256: imageHash, model, result });
      if (error && error.code !== "23505") console.error("nutrition-scan cache write failed:", error.message);
      console.log(JSON.stringify({
        fn: "nutrition-scan",
        uid,
        ms: result.latency_ms,
        model,
        scene: result.scene,
        // Never the label values themselves — only how many fields were printed.
        fields: result.label ? Object.keys(result.label.values).length : null,
        items: result.items.length,
        needs_choice: result.items.filter((i) => i.needs_user_choice).length,
        pass2: result.items.filter((i) => i.pass2).length,
        overall: result.overall_confidence,
        cache_hit: false,
      }));
      return json(result);
    };
    const base = {
      estimated: true as const,
      scan_id: scanId,
      scene_type: scan.scene_type,
      scene_notes: scan.scene_notes,
      references_seen: scan.references_seen,
      plate_cm_estimate: scan.plate_cm_estimate,
      scale_confidence: scan.scale_confidence,
      barcode_seen: scan.barcode_seen,
      prompt_version: PROMPT_VERSION,
      cache_hit: false,
    };

    // ── Label scene: one isolated transcription call, no retry ─────────
    if ((scan.scene_type === "nutrition_label" || scan.scene_type === "packaged_product") && scan.label_visible && stageTimeout() > 0) {
      const read = await callTool({
        system: LABEL_PROMPT,
        content: [{ type: "text", text: "Transcribe the label." }, ...images],
        tool: buildLabelToolSchema(),
        toolName: "report_nutrition_label",
        maxTokens: 800,
        timeoutMs: stageTimeout(),
        retry: false,
      });
      const label = read.kind === "ok" ? validateLabelArgs(read.args) : null;
      if (label) {
        return finish({
          ...base,
          scene: "label",
          label,
          barcode_seen: label.barcode_seen || scan.barcode_seen,
          overall_confidence: 0,
          low_confidence: true,
          not_food: false,
          model,
          latency_ms: Date.now() - startedAt,
          items: [],
        });
      }
    }

    if (!scan.is_food) {
      return finish({
        ...base,
        scene: "meal",
        label: null,
        overall_confidence: 0,
        low_confidence: true,
        not_food: true,
        model,
        latency_ms: Date.now() - startedAt,
        items: [],
      });
    }

    // ── Portions: liquids → counts → honest range ───────────────────────
    const est = scan.items.map((it) => {
      const e = applyCount(applyLiquid(it));
      const r = sanitizeRange(e.estimated_grams, e.grams_low, e.grams_high, e.portion_confidence, e.category);
      return { ...e, estimated_grams: r.est, grams_low: r.low, grams_high: r.high };
    });

    // ── Candidates from the DB (user client ⇒ RLS: public + own foods),
    //    ≤ 3 terms × ≤ 12 items in ONE Promise.all. ──────────────────────
    const lookups = await Promise.all(
      est.map((it) =>
        Promise.all(
          it.canonical_search_terms.slice(0, 3).map((term) =>
            userClient.rpc("search_foods", { p_query: term, p_limit: 3, p_country: country, p_barcode: null }),
          ),
        ),
      ),
    );
    const picked = est.map((it, i) => {
      const results = lookups[i];
      if (results.some((r) => r.error)) return pickCandidate([], 0); // degrade this item only
      const rows: unknown[] = results.flatMap((r) => (Array.isArray(r.data) ? r.data : []));
      const cands = rows.map(toCandidateFields).filter((c): c is Candidate => c !== null);
      return pickCandidate(cands, it.identification_confidence, (scan.scene_type === "meal" ? GENERIC_BONUS_MEAL : GENERIC_BONUS_PACKAGED));
    });

    // ── Online fallback for zero-candidate items (OFF/USDA via nutrition-lookup) ──
    const online: ScanItem["online_lookup"][] = est.map(() => "skipped");
    const misses = picked.map((p, i) => (p.candidates.length === 0 ? i : -1)).filter((i) => i >= 0).slice(0, ONLINE_FALLBACK_MAX);
    if (misses.length && remaining() >= ONLINE_MIN_REMAINING_MS) {
      await Promise.all(
        misses.map(async (i) => {
          try {
            const res = await fetch(`${supabaseUrl}/functions/v1/nutrition-lookup`, {
              method: "POST",
              headers: { Authorization: authHeader, apikey: supabaseAnon, "Content-Type": "application/json" },
              body: JSON.stringify({ q: est[i].canonical_search_terms[0], country }),
              signal: AbortSignal.timeout(ONLINE_TIMEOUT_MS),
            });
            if (!res.ok) return;
            const data: unknown = await res.json();
            const foods = isRecord(data) && Array.isArray(data.foods) ? data.foods : [];
            const cands = foods.map(toCandidateFields).filter((c): c is Candidate => c !== null);
            online[i] = cands.length ? "hit" : "miss";
            if (cands.length) picked[i] = pickCandidate(cands, est[i].identification_confidence, (scan.scene_type === "meal" ? GENERIC_BONUS_MEAL : GENERIC_BONUS_PACKAGED));
          } catch (e) {
            console.warn("nutrition-scan online fallback failed:", e instanceof Error ? e.message : String(e));
          }
        }),
      );
    }

    let items: ScanItem[] = est.map((it, i) => ({
      id: crypto.randomUUID(),
      name: it.name,
      category: it.category,
      preparation: it.preparation,
      grams: it.estimated_grams,
      grams_low: it.grams_low,
      grams_high: it.grams_high,
      count: it.count,
      is_liquid: it.is_liquid,
      ml: it.ml,
      density_g_per_ml: it.density_g_per_ml,
      unit_g: it.unit_g,
      box: it.box,
      identification_confidence: it.identification_confidence,
      portion_confidence: it.portion_confidence,
      needs_user_choice: picked[i].needs_user_choice,
      selected_food_id: picked[i].selected?.food_id ?? null,
      candidates: picked[i].candidates,
      online_lookup: online[i],
      pass2: false,
      preview: null,
    }));

    // ── Pass 2: one batched second look at shaky items, no retry ────────
    const second = selectForPass2(items);
    if (second.length && stageTimeout() > 0) {
      const listing = second
        .map((i) => {
          const it = items[i];
          const box = it.box ? `box [${it.box.x0},${it.box.y0},${it.box.x1},${it.box.y1}]` : "box unknown";
          const cands = it.candidates.length
            ? it.candidates.map((c, k) => `${k}: ${c.name}${c.brand ? ` (${c.brand})` : ""} [${isGenericSource(c) ? "generic" : "packaged"}]`).join("; ")
            : "none";
          return `#${i} "${it.name}" · ${box} · ${it.ml != null ? `${it.ml} ml` : `${it.grams} g`} · candidates: ${cands}`;
        })
        .join("\n");
      const refine = await callTool({
        system: PASS2_PROMPT,
        content: [{ type: "text", text: `Items to refine:\n${listing}` }, ...images],
        tool: buildRefineToolSchema(),
        toolName: "refine_items",
        maxTokens: 1200,
        timeoutMs: stageTimeout(),
        retry: false,
      });
      if (refine.kind === "ok") {
        const rows = validateRefineArgs(refine.args, items.length, items.map((it) => it.candidates.length)).filter((r) => second.includes(r.index));
        items = mergePass2(items, rows);
      }
    }

    // ── Nutrition previews from the DB with the FINAL grams ─────────────
    const previews = await Promise.all(
      items.map(async (it): Promise<Preview> => {
        if (!it.selected_food_id) return null;
        const { data, error } = await userClient.rpc("nutrition_for_grams", { p_food_id: it.selected_food_id, p_grams: it.grams });
        return error ? null : toPreview(data);
      }),
    );
    items = items.map((it, i) => ({ ...it, preview: previews[i] }));

    const overall = overallConfidence(items);
    return finish({
      ...base,
      scene: "meal",
      label: null,
      overall_confidence: overall,
      low_confidence: overall < LOW_CONFIDENCE || items.some((i) => i.needs_user_choice),
      not_food: false,
      model,
      latency_ms: Date.now() - startedAt,
      items,
    });
  } catch (e) {
    console.error("nutrition-scan error:", e instanceof Error ? e.message : String(e));
    return json({ error: "scan_failed" }, 500);
  }
});
