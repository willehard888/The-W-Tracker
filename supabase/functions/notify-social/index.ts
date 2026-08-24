import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Internal-only: DB triggers invoke this with the service-role key.
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

// Social pushes that never existed before the notification inbox: friend
// requests, friend accepts and 1v1 battle challenges. The in-app ledger row
// is written by the DB trigger; this only delivers the APNs push.
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

  try {
    const { kind, user_id, actor_id } = await req.json();
    if (!kind || !user_id) {
      return new Response(JSON.stringify({ error: "kind and user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, serviceKey);
    const { data: actor } = actor_id
      ? await supabase.from("profiles").select("username").eq("user_id", actor_id).maybeSingle()
      : { data: null };
    const name = (actor as { username?: string } | null)?.username ? `@${(actor as { username: string }).username}` : "Someone";

    const payload =
      kind === "friend_request"
        ? { title: "👋 New friend request", body: `${name} wants to be friends. Accept from your notifications.`, data: { route: "/notifications" } }
        : kind === "friend_accepted"
        ? { title: "🤝 Request accepted", body: `${name} accepted your friend request.`, data: { route: "/friends" } }
        : kind === "battle_challenge"
        ? { title: "⚔️ Battle challenge", body: `${name} challenged you to a battle. Accept before it expires.`, data: { route: "/notifications" } }
        : null;

    if (!payload) {
      return new Response(JSON.stringify({ error: `unknown kind ${kind}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tokens } = await supabase
      .from("push_tokens").select("token, platform").eq("user_id", user_id);

    let sent = 0;
    if (tokens && tokens.length > 0) {
      const results = await sendApnsBatch(tokens as { token: string; platform: string }[], payload);
      sent = results.filter((r) => r.status === 200).length;
      const dead = results
        .filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered")
        .map((r) => r.token);
      if (dead.length) await supabase.from("push_tokens").delete().in("token", dead);
    }

    await supabase.from("analytics_events").insert({
      user_id,
      event: "social_push_sent",
      props: { kind, actor_id: actor_id ?? null },
    });

    return new Response(JSON.stringify({ ok: true, sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-social error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
