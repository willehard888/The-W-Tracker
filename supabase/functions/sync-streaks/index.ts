import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Accept the internal caller: an exact match on the env service key, OR any JWT
// whose role claim is service_role. verify_jwt (default true for this function)
// means Supabase already validated the signature, so trusting the decoded role
// is safe — and it tolerates key rotation / stray whitespace that would break an
// exact string compare.
function isServiceRole(token: string, envKey: string): boolean {
  if (!token) return false;
  if (envKey && token === envKey) return true;
  try {
    const seg = token.split(".")[1];
    if (!seg) return false;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.length % 4 ? b64 + "=".repeat(4 - (b64.length % 4)) : b64;
    const payload = JSON.parse(atob(padded));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Scheduled (pg_cron) daily maintenance:
//   1. Decay broken streaks to 0 — but honor streak shields (each shield extends
//      the grace window by a day, matching record_checkin's shield tolerance),
//      so we never zero a streak a shield would have saved.
//   2. Recompute ALL status tiers/divisions — so ranks/percentiles stay fresh as
//      the population moves, not just when a user checks in.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Internal-only: cron (and admins) call with the service-role key as bearer.
    // The previous version required a USER JWT via getUser(), which the cron's
    // service-role key fails — so streak decay silently never ran.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!serviceKey || token !== serviceKey) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const [{ data: profiles, error: profilesError }, { data: checkins, error: checkinsError }] = await Promise.all([
      supabase.from("profiles").select("user_id, streak, streak_shields").gt("streak", 0),
      supabase.from("daily_checkins").select("user_id, checked_in_at")
        .order("checked_in_at", { ascending: false }).limit(10000),
    ]);
    if (profilesError) throw profilesError;
    if (checkinsError) throw checkinsError;

    const latestCheckinByUser = new Map<string, string>();
    for (const c of checkins || []) {
      if (!latestCheckinByUser.has(c.user_id)) latestCheckinByUser.set(c.user_id, c.checked_in_at);
    }

    const now = Date.now();
    const expiredUserIds = (profiles || [])
      .filter((p) => {
        const shields = Math.max(0, (p as any).streak_shields ?? 0);
        // Base grace = 2 days (yesterday's window); each shield buys one more day.
        const graceMs = (2 + shields) * DAY_MS;
        const last = latestCheckinByUser.get(p.user_id);
        if (!last) return p.streak > 0;                    // streak but no checkin row
        const lastMs = new Date(last).getTime();
        if (Number.isNaN(lastMs)) return false;
        return now - lastMs >= graceMs;
      })
      .map((p) => p.user_id);

    if (expiredUserIds.length > 0) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ streak: 0, updated_at: new Date().toISOString() })
        .in("user_id", expiredUserIds);
      if (updateError) throw updateError;
    }

    // Always refresh tiers/divisions (percentiles shift as others progress).
    const { error: tierErr } = await supabase.rpc("update_all_status_tiers");
    if (tierErr) console.error("update_all_status_tiers failed:", tierErr);

    return json({ expiredCount: expiredUserIds.length, tiersRecomputed: !tierErr });
  } catch (error) {
    console.error("sync-streaks error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
