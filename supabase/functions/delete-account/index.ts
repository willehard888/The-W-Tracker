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

    // ── Recoverable snapshot BEFORE destroying anything ────────────────
    // Captures the high-value, hard-to-reconstruct data into an archive
    // table that survives the cascade. If the archive write fails we ABORT
    // the deletion — better to leave the account intact than to destroy it
    // with no recovery path. (This is what was missing when a real account
    // got permanently wiped.)
    try {
      const [profileRow, checkins, badges, roles, posts, referrals] = await Promise.all([
        serviceClient.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        serviceClient.from("daily_checkins").select("*").eq("user_id", user.id),
        serviceClient.from("user_badges").select("*").eq("user_id", user.id),
        serviceClient.from("user_roles").select("*").eq("user_id", user.id),
        serviceClient.from("feed_posts").select("*").eq("user_id", user.id),
        serviceClient.from("referrals").select("*").eq("referrer_id", user.id),
      ]);

      const { error: archiveError } = await serviceClient
        .from("deleted_account_archives")
        .insert({
          user_id: user.id,
          email: user.email ?? null,
          username: (profileRow.data as { username?: string } | null)?.username ?? null,
          payload: {
            profile: profileRow.data ?? null,
            daily_checkins: checkins.data ?? [],
            user_badges: badges.data ?? [],
            user_roles: roles.data ?? [],
            feed_posts: posts.data ?? [],
            referrals: referrals.data ?? [],
            archived_by: "delete-account",
          },
        });

      if (archiveError) {
        console.error("delete-account archive failed, aborting:", archiveError);
        return new Response(
          JSON.stringify({ error: "Could not safely archive account before deletion. Aborted — your data is intact. Please try again later." }),
          { status: 500, headers: jsonHeaders },
        );
      }
    } catch (archiveErr) {
      console.error("delete-account archive threw, aborting:", archiveErr);
      return new Response(
        JSON.stringify({ error: "Could not safely archive account before deletion. Aborted — your data is intact." }),
        { status: 500, headers: jsonHeaders },
      );
    }

    // A tribe outlives its owner. Every table under tribes cascades on delete,
    // so wiping an owned tribe would take every other member's posts, events
    // and battles with it: hand it to the longest-standing remaining member
    // instead, and only delete a tribe nobody else is in.
    try {
      const { data: owned } = await serviceClient.from("tribes").select("id").eq("owner_id", user.id);
      for (const t of (owned ?? []) as { id: string }[]) {
        const { data: heir } = await serviceClient
          .from("tribe_members")
          .select("user_id")
          .eq("tribe_id", t.id)
          .neq("user_id", user.id)
          .order("joined_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        const heirId = (heir as { user_id?: string } | null)?.user_id;
        if (heirId) {
          await serviceClient.from("tribes").update({ owner_id: heirId }).eq("id", t.id);
          await serviceClient.from("tribe_members").update({ role: "owner" })
            .eq("tribe_id", t.id).eq("user_id", heirId);
        } else {
          await serviceClient.from("tribes").delete().eq("id", t.id);
        }
      }
    } catch (e) { console.warn("delete-account: owned tribes skipped", e); }

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

    // Coach, health, habit, analytics and membership PII the original list
    // missed — GDPR/Apple deletion must remove ALL of it. Resilient: a table
    // that doesn't exist or is already empty must not abort the deletion.
    const extraTables = [
      "coach_chat_memory", "coach_athlete_profile", "coach_programs", "coach_program_logs",
      "coach_daily_briefs", "coach_daily_plans", "coach_mission_logs", "coach_reflections",
      "coach_goals", "coach_performance_snapshots", "coach_weekly_reviews", "coach_nudges",
      "weekly_briefings", "vault_lesson_progress", "vault_reflections", "user_habits", "user_habit_logs",
      "analytics_events", "tribe_members", "tribe_event_rsvps",
      "moderation_queue", "health_night_metrics", "workout_set_logs",
      "health_sync_snapshots", "ai_usage", "coach_preference_signals",
      "pilot_code_redemptions", "pod_members",
      // Tribes: the member's own contributions. The tribes they own are
      // handled above, because deleting one cascades over everybody else's.
      "tribe_posts", "tribe_post_comments", "tribe_post_reactions",
      // Nutrition engine: diary, targets, recipes, favourites, scan cache
      // (auth.users cascades cover these too — explicit is the house rule).
      "meal_log_items", "meal_logs", "nutrition_targets", "nutrition_recipes",
      "food_favorites", "meal_scan_cache", "meal_scan_reviews",
    ];
    for (const t of extraTables) {
      try { await serviceClient.from(t).delete().eq("user_id", user.id); }
      catch (e) { console.warn(`delete-account: ${t} skipped`, e); }
    }
    // Tables that name the member by something other than user_id. Each pair
    // is swept on both sides so nothing is left pointing at a deleted account:
    // an unanswered tribe invite, a block the other side can no longer lift,
    // kudos on a post that is gone, a notification about a vanished actor.
    const otherKeys: [string, string][] = [
      ["foods", "owner_id"],
      ["pods", "owner_id"],
      ["notifications", "user_id"], ["notifications", "actor_id"],
      ["blocked_users", "blocker_id"], ["blocked_users", "blocked_id"],
      ["tribe_invites", "inviter_id"], ["tribe_invites", "invitee_id"],
      ["tribe_post_kudos", "giver_id"], ["tribe_post_kudos", "receiver_id"],
      ["tribe_post_reports", "reporter_id"],
    ];
    for (const [t, col] of otherKeys) {
      try { await serviceClient.from(t).delete().eq(col, user.id); }
      catch (e) { console.warn(`delete-account: ${t}.${col} skipped`, e); }
    }

    // The waitlist keys on the email address, not the account.
    if (user.email) {
      try { await serviceClient.from("waitlist").delete().eq("email", user.email); }
      catch (e) { console.warn("delete-account: waitlist skipped", e); }
    }

    // Storage: everything under the member's folder in every bucket they
    // write to. `avatars` is PUBLIC, so a face left behind stayed fetchable
    // forever; list() returns 100 names by default, so it is paged until a
    // short page (removal shrinks the folder, the offset stays at zero).
    for (const bucket of ["proof-photos", "feed-images", "meal-photos", "avatars"]) {
      try {
        for (let page = 0; page < 50; page++) {
          const { data: files } = await serviceClient.storage.from(bucket).list(user.id, { limit: 1000 });
          const names = (files ?? []).filter((f) => f.id).map((f) => `${user.id}/${f.name}`);
          if (names.length === 0) break;
          await serviceClient.storage.from(bucket).remove(names);
          if (names.length < 1000) break;
        }
      } catch (e) { console.warn(`delete-account: storage ${bucket} skipped`, e); }
    }

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