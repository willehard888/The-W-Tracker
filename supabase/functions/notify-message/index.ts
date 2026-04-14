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

    const { receiver_id, message_preview } = await req.json();
    if (!receiver_id) {
      return new Response(JSON.stringify({ error: "receiver_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Look up sender username from DB instead of trusting request body
    const { data: senderProfile } = await serviceClient
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .single();

    const senderUsername = senderProfile?.username || "Someone";

    // Get receiver's push tokens
    const { data: tokens } = await serviceClient
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", receiver_id);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ message: "No tokens for receiver" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      title: `💬 ${senderUsername} sent you a message`,
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
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
