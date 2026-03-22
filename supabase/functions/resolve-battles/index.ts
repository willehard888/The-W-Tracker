import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find active battles that have expired
  const { data: expiredBattles, error } = await supabase
    .from("battles")
    .select("*")
    .eq("status", "active")
    .not("started_at", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const now = Date.now();
  let resolved = 0;

  for (const battle of expiredBattles || []) {
    const startDate = new Date(battle.started_at).getTime();
    const endDate = startDate + battle.duration_days * 24 * 60 * 60 * 1000;

    if (now < endDate) continue; // Not expired yet

    const challengerHasProof = !!battle.challenger_proof_url;
    const opponentHasProof = !!battle.opponent_proof_url;

    let winnerId: string | null = null;

    if (!challengerHasProof && !opponentHasProof) {
      // Both forfeit — no winner
      winnerId = null;
    } else if (!challengerHasProof) {
      // Challenger forfeits
      winnerId = battle.opponent_id;
    } else if (!opponentHasProof) {
      // Opponent forfeits
      winnerId = battle.challenger_id;
    } else {
      // Both have proof — decide by score
      if (battle.challenger_score > battle.opponent_score) {
        winnerId = battle.challenger_id;
      } else if (battle.opponent_score > battle.challenger_score) {
        winnerId = battle.opponent_id;
      } else {
        winnerId = null; // Tie
      }
    }

    await supabase
      .from("battles")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        winner_id: winnerId,
      })
      .eq("id", battle.id);

    // Award XP to winner
    if (winnerId) {
      await supabase.rpc("update_status_tier", { target_user_id: winnerId });
    }

    resolved++;
  }

  return new Response(
    JSON.stringify({ resolved, checked: expiredBattles?.length || 0 }),
    { headers: { "Content-Type": "application/json" } }
  );
});
