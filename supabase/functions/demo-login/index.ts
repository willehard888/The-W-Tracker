import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEMO_EMAIL = "demo@thewtracker.com";
const DEMO_PASSWORD = "DemoAccount2025!";
const DEMO_USERNAME = "demo_user";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
        await adminClient.from("profiles").update({
          xp: 2450,
          level: 8,
          streak: 12,
          longest_streak: 23,
          display_name: "Demo User",
          status_tier: "rising",
        }).eq("user_id", newUser.user.id);
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
