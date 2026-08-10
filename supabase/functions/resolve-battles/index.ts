import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Internal-only caller: cron invokes with the service-role key. Accept an exact
// env match OR any JWT whose role claim is service_role (verify_jwt defaults to
// true for this function, so Supabase already validated the signature). Without
// this, ANY authenticated member could force-resolve battles — deciding winners
// and awarding status tiers.
function isServiceRole(token: string, envKey: string): boolean {
  if (!token) return false;
  if (envKey && token === envKey) return true;
  try {
    const seg = token.split(".")[1];
    if (!seg) return false;
    const b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.length % 4 ? b64 + "=".repeat(4 - (b64.length % 4)) : b64;
    return JSON.parse(atob(padded))?.role === "service_role";
  } catch {
    return false;
  }
}

// Activity-based battle types we can cross-check against Apple HealthKit.
const VERIFIABLE_TYPES = ["xp", "workout", "streak"];

// Returns true if the user has real HealthKit activity in the battle window,
// null for types HealthKit can't confirm (cold_shower/meditation/hydration).
async function winnerActivityVerified(
  supabase: any,
  userId: string,
  startMs: number,
  endMs: number,
  battleType: string,
): Promise<boolean | null> {
  if (!VERIFIABLE_TYPES.includes(battleType)) return null;
  const startDate = new Date(startMs).toISOString().slice(0, 10);
  const endDate = new Date(endMs).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("health_sync_snapshots")
    .select("steps, workout_minutes, workout_count")
    .eq("user_id", userId)
    .gte("snapshot_date", startDate)
    .lte("snapshot_date", endDate);
  if (!data || data.length === 0) return false;
  return data.some(
    (s: any) => (s.workout_count ?? 0) >= 1 || (s.workout_minutes ?? 0) >= 15 || (s.steps ?? 0) >= 8000,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!isServiceRole(token, serviceKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

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
      const winnerVerified = winnerId
        ? await winnerActivityVerified(supabase, winnerId, new Date(battle.started_at).getTime(), endDate, battle.battle_type)
        : null;
      // Status guard: two overlapping runs (15-min cron + manual invoke) must
      // not both resolve — only the run that still sees "active" wins.
      const { data: updatedRows } = await supabase.from("battles").update({
        status: "completed",
        ended_at: new Date().toISOString(),
        winner_id: winnerId,
        winner_verified: winnerVerified,
        verification_notes: { battle_type: battle.battle_type, winner_verified: winnerVerified },
      }).eq("id", battle.id).eq("status", "active").select("id");
      if (!updatedRows?.length) continue; // another run already resolved it
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
    // Null/invalid ended_at → NaN comparisons silently skipped the 1-hour
    // voting window; treat as "not resolvable yet" instead.
    const endedAt = battle.ended_at ? new Date(battle.ended_at).getTime() : NaN;
    if (Number.isNaN(endedAt)) continue;
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

    const winnerVerified = winnerId
      ? await winnerActivityVerified(supabase, winnerId, new Date(battle.started_at).getTime(), endedAt, battle.battle_type)
      : null;
    const { data: votedRows } = await supabase.from("battles").update({
      status: "completed",
      winner_id: winnerId,
      winner_verified: winnerVerified,
      verification_notes: { battle_type: battle.battle_type, winner_verified: winnerVerified, resolved_by: "vote" },
    }).eq("id", battle.id).eq("status", "voting").select("id");
    if (!votedRows?.length) continue; // another run already resolved it
    if (winnerId) await supabase.rpc("update_status_tier", { target_user_id: winnerId });
    resolved++;
  }

  return new Response(
    JSON.stringify({ resolved }),
    { headers: { "Content-Type": "application/json" } }
  );
});
