// founder-digest — the daily numbers, pushed to admin devices.
//
// Computes the headline growth numbers DIRECTLY with the service client (the
// admin_* RPCs check has_role(auth.uid()) and RAISE under service role — no
// uid exists in a cron call) and delivers a compact digest via APNs to every
// admin user's devices, deep-linking to /admin/metrics.
//
// Cron-only (service role guard, same pattern as coach-insights).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchAll } from "../_shared/fetch-all.ts";
import { sendApnsBatch } from "../_shared/apns.ts";
import { isServiceRole } from "../_shared/service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

// deno-lint-ignore no-explicit-any
async function distinctCheckinUsers(supabase: any, fromISO: string, toISO?: string): Promise<number> {
  // Paged: the un-ranged select capped at 1000 check-ins and under-reported
  // DAU/WAU as soon as a week held more than that.
  const rows = await fetchAll<{ user_id: string }>((from, to) => {
    let q = supabase.from("daily_checkins").select("user_id").gte("checked_in_at", fromISO);
    if (toISO) q = q.lt("checked_in_at", toISO);
    return q.order("checked_in_at").range(from, to);
  });
  return new Set(rows.map((r) => r.user_id)).size;
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
    // Money is production only. App Review and TestFlight buy in the sandbox,
    // and those purchases unlock the app too, but they are not revenue.
    const { count: prodPurchases } = await supabase
      .from("analytics_events").select("id", { count: "exact", head: true })
      .eq("event", "purchase_completed").gte("created_at", daysAgo(7))
      .or("props->>sandbox.is.null,props->>sandbox.neq.true");
    const purchases = prodPurchases ?? 0;
    const trials = await countEvents(supabase, "trial_started", daysAgo(7));

    // ── Reach: did reminders leave the server, did anyone tap one ────────
    const pushSent = await countEvents(supabase, "push_sent", daysAgo(7));
    const pushOpened = await countEvents(supabase, "push_opened", daysAgo(7));

    // ── Retention: D7 of the latest mature cohort (signed up 8-14d ago) ──
    // Both windows mirror admin_retention_cohorts: D1 = a check-in on day 1
    // (cohort signed up 2-8 days ago), D7 = a check-in on day 5-9 (8-14 days ago).
    const retention = async (fromDaysAgo: number, toDaysAgo: number, lo: number, hi: number) => {
      const { data: cohort } = await supabase
        .from("profiles").select("user_id, created_at")
        .gte("created_at", daysAgo(fromDaysAgo)).lt("created_at", daysAgo(toDaysAgo));
      const cohortRows = cohort ?? [];
      if (cohortRows.length === 0) return "—";
      const ids = cohortRows.map((r: { user_id: string }) => r.user_id);
      const { data: checks } = await supabase
        .from("daily_checkins").select("user_id, checked_in_at")
        .in("user_id", ids).gte("checked_in_at", daysAgo(fromDaysAgo));
      const byUser = new Map<string, string[]>();
      for (const c of checks ?? []) {
        const arr = byUser.get(c.user_id) ?? [];
        arr.push(c.checked_in_at);
        byUser.set(c.user_id, arr);
      }
      let returned = 0;
      for (const u of cohortRows) {
        const signup = new Date(u.created_at).getTime();
        const hits = (byUser.get(u.user_id) ?? []).some((t: string) => {
          const d = Math.floor((new Date(t).getTime() - signup) / 86400000);
          return d >= lo && d <= hi;
        });
        if (hits) returned++;
      }
      return `${Math.round((100 * returned) / cohortRows.length)}%`;
    };
    const d1Str = await retention(8, 2, 1, 1);
    const d7Str = await retention(14, 8, 5, 9);

    // ── Health: three things that fail silently ──────────────────────────
    // Every one of these has broken in production without anybody noticing
    // for days, because nothing pages and nothing goes red. The digest is
    // the only alarm this app has, so it carries them.

    // 1. Money. RevenueCat's webhook writes a ledger row; the client writes a
    //    purchase_completed. If those two counts diverge, one of the halves is
    //    down — and the half that is down might be the one granting access.
    const { count: webhookPurchases } = await supabase
      .from("webhook_events").select("event_id", { count: "exact", head: true })
      .eq("event_type", "INITIAL_PURCHASE").eq("environment", "PRODUCTION").gte("created_at", daysAgo(7));

    // 2. Push. A send that returns non-200 still writes its row, with ok:false.
    const { count: pushFailed } = await supabase
      .from("analytics_events").select("id", { count: "exact", head: true })
      .eq("event", "push_sent").eq("props->>ok", "false").gte("created_at", daysAgo(7));
    const failPct = pushSent > 0 ? Math.round((100 * (pushFailed ?? 0)) / pushSent) : 0;

    // 3. Cron. coach-insights writes a snapshot row every night at 03:15; the
    //    age of the newest one is the cheapest proof the scheduler is alive.
    const { data: lastSnap } = await supabase
      .from("coach_performance_snapshots").select("created_at")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const cronAgeH = lastSnap?.created_at
      ? Math.floor((Date.now() - new Date(lastSnap.created_at).getTime()) / 3600000)
      : null;
    const cronStr = cronAgeH === null ? "cron ?" : cronAgeH <= 30 ? `cron ok` : `cron ${cronAgeH}h ⚠`;
    const moneyStr = (webhookPurchases ?? 0) === purchases
      ? `money ok`
      : `money ${webhookPurchases ?? 0}w/${purchases}c ⚠`;

    const title = "The numbers";
    const body =
      `WAU ${wau} (${deltaStr}) · ${newUsers ?? 0} new · ` +
      `${purchases} purchase${purchases === 1 ? "" : "s"} · ${trials} trials · ` +
      `D1 ${d1Str} · D7 ${d7Str} · push ${pushSent} sent / ${pushOpened} opened` +
      ` · ${moneyStr} · push fail ${failPct}% · ${cronStr}`;

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
      .from("push_tokens").select("user_id, token, platform").in("user_id", adminIds);
    if (!tokens || tokens.length === 0) {
      console.log("founder-digest: no admin push tokens; digest was:", body);
      return;
    }

    // deno-lint-ignore no-explicit-any
    const results = await sendApnsBatch(tokens as any, {
      title,
      body,
      data: { route: "/admin/metrics" },
    }, { supabase, kind: "founder_digest" });
    const sent = results.filter((r) => r.status === 200).length;
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
