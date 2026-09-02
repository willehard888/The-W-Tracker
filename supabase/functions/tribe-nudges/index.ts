import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";
import { getPushTargets } from "../_shared/push-targets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Runs hourly. Every run: event reminders (T-24h and T-1h windows).
// At 17:00 UTC (evening in the core market): the fire-at-risk nudge —
// members whose tribemates have checked in today while they haven't.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!isServiceRole(token, serviceKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, serviceKey);

  const pushTo = async (userIds: string[], title: string, body: string, route: string): Promise<number> => {
    if (userIds.length === 0) return 0;
    const tokens = await getPushTargets(supabase, userIds, "tribe");
    if (tokens.length === 0) return 0;
    const results = await sendApnsBatch(tokens, { title, body, data: { route }, threadId: "tribe" });
    const dead = results
      .filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered")
      .map((r) => r.token);
    if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);
    return results.filter((r) => r.status === 200).length;
  };

  try {
    let sent = 0;
    const now = new Date();

    // ── Event reminders: starts_at in [23.5h, 24.5h) or [0.5h, 1.5h) ──
    for (const [fromH, toH, label] of [[23.5, 24.5, "tomorrow"], [0.5, 1.5, "in 1 hour"]] as const) {
      const from = new Date(now.getTime() + fromH * 3600_000).toISOString();
      const to = new Date(now.getTime() + toH * 3600_000).toISOString();
      const { data: events } = await supabase
        .from("tribe_events")
        .select("id, tribe_id, title, starts_at, place, meeting_url")
        .gte("starts_at", from).lt("starts_at", to);
      for (const ev of (events ?? []) as any[]) {
        const { data: rsvps } = await supabase
          .from("tribe_event_rsvps").select("user_id, status")
          .eq("event_id", ev.id).in("status", ["going", "maybe"]);
        const ids = ((rsvps ?? []) as any[]).map((r) => r.user_id);
        const where = ev.meeting_url ? "online" : (ev.place || "meetup");
        sent += await pushTo(
          ids,
          `${ev.title} — ${label} 📅`,
          `Your tribe meets ${label} (${where}). Show up.`,
          `/tribes/${ev.tribe_id}`,
        );
      }
    }

    // ── Evening fire-at-risk nudge (17:00 UTC only) ──
    if (now.getUTCHours() === 17) {
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
      // Tribes with at least 2 check-ins today
      const { data: rows } = await supabase.rpc("tribe_fire_at_risk" as never) as { data: unknown };
      // rows: [{ user_id, tribe_name, checked, total }] — see migration RPC.
      const byUser = new Map<string, { tribe_name: string; checked: number; total: number }>();
      for (const r of ((rows ?? []) as any[])) {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, r); // first (highest-checked) tribe wins
      }
      void dayStart;
      for (const [userId, r] of byUser) {
        sent += await pushTo(
          [userId],
          `${r.checked}/${r.total} fed ${r.tribe_name}'s fire`,
          "Yours is missing. Check in before midnight — the tribe sees who shows up.",
          "/checkin",
        );
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("tribe-nudges error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
