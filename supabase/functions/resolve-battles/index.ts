import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let resolved = 0;

  // 1. Resolve expired active battles
  const { data: expiredBattles } = await supabase
    .from("battles")
    .select("*")
    .eq("status", "active")
    .not("started_at", "is", null);

  const now = Date.now();

  for (const battle of expiredBattles || []) {
    const endDate = new Date(battle.started_at).getTime() + battle.duration_days * 86400000;
    if (now < endDate) continue;

    const cProof = !!battle.challenger_proof_url;
    const oProof = !!battle.opponent_proof_url;
    let winnerId: string | null = null;

    // For XP battles, calculate delta XP from start
    let cScore = battle.challenger_score;
    let oScore = battle.opponent_score;
    if (battle.battle_type === "xp") {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, xp")
        .in("user_id", [battle.challenger_id, battle.opponent_id]);
      const cXp = profs?.find((p: any) => p.user_id === battle.challenger_id)?.xp ?? 0;
      const oXp = profs?.find((p: any) => p.user_id === battle.opponent_id)?.xp ?? 0;
      cScore = Math.max(0, cXp - (battle.challenger_start_xp ?? 0));
      oScore = Math.max(0, oXp - (battle.opponent_start_xp ?? 0));
    }

    if (!cProof && !oProof) winnerId = null;
    else if (!cProof) winnerId = battle.opponent_id;
    else if (!oProof) winnerId = battle.challenger_id;
    else if (cScore > oScore) winnerId = battle.challenger_id;
    else if (oScore > cScore) winnerId = battle.opponent_id;
    // else tie → voting

    if (cProof && oProof && cScore === oScore) {
      await supabase.from("battles").update({ status: "voting", ended_at: new Date().toISOString() }).eq("id", battle.id);
    } else {
      await supabase.from("battles").update({ status: "completed", ended_at: new Date().toISOString(), winner_id: winnerId }).eq("id", battle.id);
      if (winnerId) await supabase.rpc("update_status_tier", { target_user_id: winnerId });
    }
    resolved++;
  }

  // 2. Resolve voting battles older than 1 hour
  const { data: votingBattles } = await supabase
    .from("battles")
    .select("*")
    .eq("status", "voting");

  for (const battle of votingBattles || []) {
    const endedAt = new Date(battle.ended_at).getTime();
    const hoursSinceVoting = (now - endedAt) / 3600000;

    if (hoursSinceVoting < 1) continue; // Not yet 1 hour

    // Count votes
    const { data: votes } = await supabase
      .from("battle_votes")
      .select("voted_for")
      .eq("battle_id", battle.id);

    const challengerVotes = (votes || []).filter(v => v.voted_for === battle.challenger_id).length;
    const opponentVotes = (votes || []).filter(v => v.voted_for === battle.opponent_id).length;

    let winnerId: string | null = null;
    if (challengerVotes > opponentVotes) winnerId = battle.challenger_id;
    else if (opponentVotes > challengerVotes) winnerId = battle.opponent_id;
    // else still tie → no winner

    await supabase.from("battles").update({ status: "completed", winner_id: winnerId }).eq("id", battle.id);
    if (winnerId) await supabase.rpc("update_status_tier", { target_user_id: winnerId });
    resolved++;
  }

  return new Response(
    JSON.stringify({ resolved }),
    { headers: { "Content-Type": "application/json" } }
  );
});
