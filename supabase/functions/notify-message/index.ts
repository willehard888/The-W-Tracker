import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";
import { getPushTargets } from "../_shared/push-targets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { receiver_id } = await req.json();
    if (!receiver_id) {
      return new Response(JSON.stringify({ error: "receiver_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // IDOR guard: only allow notifying a user the caller has an actual
    // conversation with. Without this, any authenticated user could push
    // arbitrary text to any other user_id they enumerate (harassment/spam).
    // A DM row from the caller to the receiver must already exist.
    const { count: convoCount, error: convoErr } = await serviceClient
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", user.id)
      .eq("receiver_id", receiver_id);

    if (convoErr || !convoCount || convoCount === 0) {
      return new Response(
        JSON.stringify({ error: "Not authorized to notify this user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Look up sender username from DB instead of trusting request body
    const { data: senderProfile } = await serviceClient
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .single();

    const senderUsername = senderProfile?.username || "Someone";

    // Don't trust message_preview from the body — an attacker who sent one DM
    // could then loop this endpoint with arbitrary text under the sender's
    // name. Read the actual latest message for this pair from the DB.
    const { data: latestMsg } = await serviceClient
      .from("direct_messages")
      .select("content")
      .eq("sender_id", user.id)
      .eq("receiver_id", receiver_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const previewText = (latestMsg?.content ?? "").toString().slice(0, 100) || "You have a new message";

    // In-app inbox row (the bell) — written even when the receiver has no
    // push tokens; tapping opens the thread.
    await serviceClient.from("notifications").insert({
      user_id: receiver_id,
      kind: "message",
      title: `💬 ${senderUsername} sent you a message`,
      body: previewText,
      route: `/chat/${user.id}`,
      actor_id: user.id,
    });

    // Get receiver's push tokens (skipped entirely if they muted Social —
    // the inbox row above still lands, so nothing is lost).
    const tokens = await getPushTargets(serviceClient, [receiver_id], "social");

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No tokens for receiver" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      title: `💬 ${senderUsername} sent you a message`,
      body: previewText,
      data: { route: "/messages" },
      threadId: "social",
      // Rapid-fire messages from the same sender replace, not stack.
      collapseId: `chat-${user.id}`,
    };

    const results = await sendApnsBatch(tokens, payload);
    const sent = results.filter((r) => r.status === 200).length;
    const failed = results.filter((r) => r.status !== 200);

    if (failed.length > 0) {
      console.warn("APNs failures:", failed);
      // Clean up invalid tokens (BadDeviceToken / Unregistered)
      const dead = failed
        .filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered")
        .map((r) => r.token);
      if (dead.length > 0) {
        await serviceClient.from("push_tokens").delete().in("token", dead);
        console.log(`Cleaned up ${dead.length} invalid tokens`);
      }
    }

    console.log(`Push for ${receiver_id}: sent=${sent}, failed=${failed.length}`);

    return new Response(
      JSON.stringify({ sent, failed: failed.length, total: tokens.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Notify error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
