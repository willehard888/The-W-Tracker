import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";
import { getPushTargets } from "../_shared/push-targets.ts";
import { battlePushCopy, isBattlePushKind } from "../_shared/battle-push.ts";
import { isServiceRole } from "../_shared/service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Social pushes that never existed before the notification inbox: friend
// requests, friend accepts and the 1v1 battle events (challenge, accepted,
// declined, halfway, decided). The in-app ledger row is written by the DB
// trigger; this only delivers the APNs push.
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
        ? { title: "New friend request", body: `${name} wants to be friends. Accept from your notifications.`, data: { route: "/notifications" } }
        : kind === "friend_accepted"
        ? { title: "Request accepted", body: `${name} accepted your friend request.`, data: { route: "/friends" } }
        : isBattlePushKind(kind)
        ? battlePushCopy(kind, name)
        : null;

    if (!payload) {
      return new Response(JSON.stringify({ error: `unknown kind ${kind}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokens = await getPushTargets(supabase, [user_id], "social");

    let sent = 0;
    if (tokens.length > 0) {
      const results = await sendApnsBatch(tokens, { ...payload, threadId: "social" }, { supabase, kind: `social:${kind}` });
      sent = results.filter((r) => r.status === 200).length;
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
