// founder-digest — Monday-morning "week in review" push to admin devices.
//
// Computes the headline growth numbers DIRECTLY with the service client (the
// admin_* RPCs check has_role(auth.uid()) and RAISE under service role — no
// uid exists in a cron call) and delivers a compact digest via APNs to every
// admin user's devices, deep-linking to /admin/metrics.
//
// Cron-only (service role guard, same pattern as coach-insights).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same contract as weekly-briefing-generate: accept the exact env key OR any
// JWT whose payload role is service_role (the vault-stored key isn't always
// byte-identical to the function's env var).
function isServiceRole(token: string, envKey: string): boolean {
  if (!token) return false;
  if (envKey && token === envKey) return true;
  try {
    const seg = token.split(".")[1];
    if (!seg) return false;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.length % 4 ? b64 + "=".repeat(4 - (b64.length % 4)) : b64;
    return JSON.parse(atob(padded))?.role === "service_role";
  } catch {
    return false;
  }
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

// deno-lint-ignore no-explicit-any
async function distinctCheckinUsers(supabase: any, fromISO: string, toISO?: string): Promise<number> {
  let q = supabase.from("daily_checkins").select("user_id").gte("checked_in_at", fromISO);
  if (toISO) q = q.lt("checked_in_at", toISO);
  const { data, error } = await q;
  if (error) throw error;
  return new Set((data ?? []).map((r: { user_id: string }) => r.user_id)).size;
}

// deno-lint-ignore no-explicit-any
async function countEvents(supabase: any, event: string, fromISO: string): Promise<number> {
  const { count, error } = await supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event", event)
    .gte("created_at", fromISO);
  if (error) throw error;
  return count ?? 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!isServiceRole(token, SERVICE_KEY)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const run = async () => {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Activity: WAU this week vs last week ─────────────────────────────
    const wau = await distinctCheckinUsers(supabase, daysAgo(7));
    const wauPrev = await distinctCheckinUsers(supabase, daysAgo(14), daysAgo(7));
    const delta = wau - wauPrev;
    const deltaStr = delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : "→0";

    // ── Growth: signups + referrals this week ────────────────────────────
    const { count: newUsers } = await supabase
      .from("profiles").select("user_id", { count: "exact", head: true })
      .gte("created_at", daysAgo(7));

    // ── Money: purchases + trials this week ──────────────────────────────
    const purchases = await countEvents(supabase, "purchase_completed", daysAgo(7));
    const trials = await countEvents(supabase, "trial_started", daysAgo(7));

    // ── Retention: D7 of the latest mature cohort (signed up 8-14d ago) ──
    const { data: cohort } = await supabase
      .from("profiles").select("user_id, created_at")
      .gte("created_at", daysAgo(14)).lt("created_at", daysAgo(8));
    let d7Str = "—";
    const cohortRows = cohort ?? [];
    if (cohortRows.length > 0) {
      const ids = cohortRows.map((r: { user_id: string }) => r.user_id);
      const { data: checks } = await supabase
        .from("daily_checkins").select("user_id, checked_in_at")
        .in("user_id", ids).gte("checked_in_at", daysAgo(14));
      const byUser = new Map<string, string[]>();
      for (const c of checks ?? []) {
        const arr = byUser.get(c.user_id) ?? [];
        arr.push(c.checked_in_at);
        byUser.set(c.user_id, arr);
      }
      // D7 window mirrors admin_retention_cohorts: returned on day 5-9 post-signup.
      let returned = 0;
      for (const u of cohortRows) {
        const signup = new Date(u.created_at).getTime();
        const hits = (byUser.get(u.user_id) ?? []).some((t: string) => {
          const d = Math.floor((new Date(t).getTime() - signup) / 86400000);
          return d >= 5 && d <= 9;
        });
        if (hits) returned++;
      }
      d7Str = `${Math.round((100 * returned) / cohortRows.length)}%`;
    }

    const title = "📊 Week in review";
    const body =
      `WAU ${wau} (${deltaStr}) · ${newUsers ?? 0} new · ` +
      `${purchases} purchase${purchases === 1 ? "" : "s"} · ${trials} trials · D7 ${d7Str}`;

    // ── Deliver to every admin's devices ─────────────────────────────────
    const { data: admins, error: adminErr } = await supabase
      .from("user_roles").select("user_id").eq("role", "admin");
    if (adminErr) throw adminErr;
    const adminIds = (admins ?? []).map((r: { user_id: string }) => r.user_id);
    if (adminIds.length === 0) {
      console.log("founder-digest: no admins found");
      return;
    }

    const { data: tokens } = await supabase
      .from("push_tokens").select("token, platform").in("user_id", adminIds);
    if (!tokens || tokens.length === 0) {
      console.log("founder-digest: no admin push tokens; digest was:", body);
      return;
    }

    // deno-lint-ignore no-explicit-any
    const results = await sendApnsBatch(tokens as any, {
      title,
      body,
      data: { route: "/admin/metrics" },
    });
    const sent = results.filter((r) => r.status === 200).length;
    const dead = results
      .filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered")
      .map((r) => r.token);
    if (dead.length > 0) {
      await supabase.from("push_tokens").delete().in("token", dead);
    }
    console.log(`founder-digest: sent=${sent}/${results.length} — ${body}`);
  };

  // 202 + background work: pg_net aborts the HTTP call after 5s, which would
  // kill in-flight queries/APNs. Respond immediately, finish in waitUntil.
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil?.(
    run().catch((e) => console.error("founder-digest failed:", e)),
  ) ?? (await run());

  return new Response(JSON.stringify({ accepted: true }), {
    status: 202,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
