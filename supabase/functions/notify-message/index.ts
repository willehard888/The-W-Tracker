import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { receiver_id, sender_username, message_preview } = await req.json();
    if (!receiver_id) throw new Error("receiver_id required");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get receiver's push tokens
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", receiver_id);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No tokens for receiver" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Note: In production, send via FCM/APNs here
    // For now, log the notification payload
    const payload = {
      title: `💬 ${sender_username || "Someone"} sent you a message`,
      body: message_preview?.substring(0, 100) || "You have a new message",
      data: { route: "/messages" },
    };

    console.log(`Push notification for ${receiver_id}:`, payload, `Tokens: ${tokens.length}`);

    return new Response(
      JSON.stringify({ message: `Notification queued for ${tokens.length} devices`, payload }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Notify error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
