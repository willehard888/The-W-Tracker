import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const serviceClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    await serviceClient.from("battle_votes").delete().eq("voter_id", user.id);
    await serviceClient.from("daily_checkins").delete().eq("user_id", user.id);
    await serviceClient.from("direct_messages").delete().eq("sender_id", user.id);
    await serviceClient.from("direct_messages").delete().eq("receiver_id", user.id);
    await serviceClient.from("feed_comments").delete().eq("user_id", user.id);
    await serviceClient.from("feed_reactions").delete().eq("user_id", user.id);
    await serviceClient.from("friendships").delete().eq("requester_id", user.id);
    await serviceClient.from("friendships").delete().eq("addressee_id", user.id);
    await serviceClient.from("kudos").delete().eq("giver_id", user.id);
    await serviceClient.from("kudos").delete().eq("receiver_id", user.id);
    await serviceClient.from("push_tokens").delete().eq("user_id", user.id);
    await serviceClient.from("referrals").delete().eq("referrer_id", user.id);
    await serviceClient.from("referrals").delete().eq("referred_id", user.id);
    await serviceClient.from("reports").delete().eq("reporter_id", user.id);
    await serviceClient.from("user_badges").delete().eq("user_id", user.id);
    await serviceClient.from("user_roles").delete().eq("user_id", user.id);
    await serviceClient.from("leaderboard_season_baselines").delete().eq("user_id", user.id);
    await serviceClient.from("leaderboard_champions").delete().eq("user_id", user.id);
    await serviceClient.from("feed_posts").delete().eq("user_id", user.id);
    await serviceClient.from("battles").delete().eq("challenger_id", user.id);
    await serviceClient.from("battles").delete().eq("opponent_id", user.id);
    await serviceClient.from("profiles").delete().eq("user_id", user.id);

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("delete-account error:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete account" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("delete-account unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});