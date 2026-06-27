import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendApnsBatch } from "../_shared/apns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawCode = typeof body?.code === "string" ? body.code.trim() : "";
    if (!rawCode || rawCode.length > 40) {
      return new Response(
        JSON.stringify({ success: false, reason: "invalid_code" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Use a client bound to the caller's JWT so auth.uid() resolves inside claim_referral
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data, error } = await supabase.rpc("claim_referral", {
      p_referrer_code: rawCode,
    });

    if (error) {
      console.error("claim_referral RPC error:", error);
      return new Response(
        JSON.stringify({ success: false, reason: error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Close the loop — tell the referrer a friend just joined with their code.
    // Best-effort, never blocks the response.
    if ((data as any)?.success) {
      try {
        const { data: ud } = await supabase.auth.getUser();
        const newUserId = ud?.user?.id;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (newUserId && serviceKey) {
          const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
          const { data: me } = await admin
            .from("profiles").select("username, referred_by").eq("user_id", newUserId).maybeSingle();
          const referrerId = (me as any)?.referred_by;
          if (referrerId) {
            const { data: tokens } = await admin
              .from("push_tokens").select("token, platform").eq("user_id", referrerId);
            if (tokens && tokens.length > 0) {
              const results = await sendApnsBatch(tokens as any, {
                title: "New recruit! 🔥",
                body: `@${(me as any)?.username ?? "Someone"} joined with your code — guide them to keep going and climb your reward ladder.`,
                data: { route: "/referrals" },
              });
              const dead = results.filter((r) => r.reason === "BadDeviceToken" || r.reason === "Unregistered").map((r) => r.token);
              if (dead.length) await admin.from("push_tokens").delete().in("token", dead);
            }
          }
        }
      } catch (e) {
        console.error("referral signup notify failed:", e);
      }
    }

    return new Response(JSON.stringify(data ?? { success: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("claim-referral error:", err);
    return new Response(
      JSON.stringify({ success: false, reason: "server_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
