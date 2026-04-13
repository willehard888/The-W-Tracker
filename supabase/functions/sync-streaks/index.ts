import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STREAK_WINDOW_MS = 48 * 60 * 60 * 1000;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("sync-streaks auth error:", userError?.message);
      return json({ error: "Unauthorized" }, 401);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const [{ data: profiles, error: profilesError }, { data: checkins, error: checkinsError }] = await Promise.all([
      serviceClient
        .from("profiles")
        .select("user_id, streak")
        .gt("streak", 0),
      serviceClient
        .from("daily_checkins")
        .select("user_id, checked_in_at")
        .order("checked_in_at", { ascending: false })
        .limit(5000),
    ]);

    if (profilesError) throw profilesError;
    if (checkinsError) throw checkinsError;

    const latestCheckinByUser = new Map<string, string>();
    for (const checkin of checkins || []) {
      if (!latestCheckinByUser.has(checkin.user_id)) {
        latestCheckinByUser.set(checkin.user_id, checkin.checked_in_at);
      }
    }

    const now = Date.now();
    const expiredUserIds = (profiles || [])
      .filter((profile) => {
        const lastCheckinAt = latestCheckinByUser.get(profile.user_id);
        if (!lastCheckinAt) return profile.streak > 0;

        const lastCheckinMs = new Date(lastCheckinAt).getTime();
        if (Number.isNaN(lastCheckinMs)) return false;

        return now - lastCheckinMs >= STREAK_WINDOW_MS;
      })
      .map((profile) => profile.user_id);

    if (expiredUserIds.length > 0) {
      const { error: updateError } = await serviceClient
        .from("profiles")
        .update({ streak: 0, updated_at: new Date().toISOString() })
        .in("user_id", expiredUserIds);

      if (updateError) throw updateError;

      await serviceClient.rpc("update_all_status_tiers");
    }

    return json({ syncedCount: expiredUserIds.length });
  } catch (error) {
    console.error("sync-streaks error:", error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
