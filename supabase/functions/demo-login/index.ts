import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Credentials are NEVER hardcoded — they come from environment secrets so they
// don't live in version control. The whole endpoint is disabled unless
// DEMO_LOGIN_ENABLED=true, so a hard-paywall production build can't be bypassed
// through a shared demo account.
const DEMO_EMAIL = Deno.env.get("DEMO_EMAIL") ?? "demo@thewtracker.com";
const DEMO_PASSWORD = Deno.env.get("DEMO_PASSWORD") ?? "";
const DEMO_USERNAME = Deno.env.get("DEMO_USERNAME") ?? "demo_user";
const DEMO_ENABLED = Deno.env.get("DEMO_LOGIN_ENABLED") === "true";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Disabled by default. Requires both the feature flag and a configured password.
  if (!DEMO_ENABLED || !DEMO_PASSWORD) {
    return new Response(JSON.stringify({ error: "Demo login is disabled" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if demo user exists
    const { data: users } = await adminClient.auth.admin.listUsers();
    const demoUser = users?.users?.find((u) => u.email === DEMO_EMAIL);

    if (!demoUser) {
      // Create demo account
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { username: DEMO_USERNAME },
      });

      if (createError) {
        console.error("Failed to create demo user:", createError);
        throw createError;
      }

      // Seed some demo data
      if (newUser?.user) {
        // "rising" was never a valid status_tier enum value, so this whole
        // update silently failed and the demo user got no seed data. Use a real
        // tier; the batch recompute will keep it honest afterward.
        const { error: seedErr } = await adminClient.from("profiles").update({
          xp: 2450,
          level: 8,
          streak: 12,
          longest_streak: 23,
          display_name: "Demo User",
          status_tier: "operator",
        }).eq("user_id", newUser.user.id);
        if (seedErr) console.error("Failed to seed demo profile:", seedErr);
      }
    }

    // Sign in as demo user using anon client
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });

    if (signInError) throw signInError;

    return new Response(
      JSON.stringify({
        access_token: signInData.session?.access_token,
        refresh_token: signInData.session?.refresh_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
