import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DailyPulse {
  rankDelta: number; // positive = moved up (rank number went down)
  scoreDelta: number;
  usersBehind: number;
  hasSnapshot: boolean;
  loading: boolean;
}

interface SnapshotShape {
  rank: number;
  score: number;
  timestamp: string;
}

/**
 * Compares today's rank vs. the last snapshot stored on profiles.last_rank_snapshot.
 * Updates the snapshot once per day on first load.
 */
export const useDailyPulse = (
  userId: string | undefined,
  currentRank: number | undefined,
  currentScore: number | undefined,
  totalUsers: number | undefined,
) => {
  const [state, setState] = useState<DailyPulse>({
    rankDelta: 0,
    scoreDelta: 0,
    usersBehind: 0,
    hasSnapshot: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      // Bail until the rank has actually loaded. The caller passes the live
      // rank/totalUsers, which are undefined on cold start — running here with a
      // 0 rank would write a bogus { rank: 0 } snapshot for today (and, since we
      // only refresh once per day, poison the "climbed today" delta permanently).
      if (!userId || currentScore === undefined || !currentRank || currentRank <= 0 || !totalUsers || totalUsers <= 0) {
        return;
      }

      const { data: profileRow } = await supabase
        .from("profiles")
        .select("last_rank_snapshot")
        .eq("user_id", userId)
        .maybeSingle();

      const snap = profileRow?.last_rank_snapshot as SnapshotShape | null;
      const now = new Date();
      const todayKey = now.toISOString().slice(0, 10);
      const snapKey = snap?.timestamp ? snap.timestamp.slice(0, 10) : null;

      let rankDelta = 0;
      let scoreDelta = 0;
      const hasSnapshot = !!snap;

      if (snap) {
        // positive rankDelta = climbed (lower rank number)
        rankDelta = snap.rank - currentRank;
        scoreDelta = currentScore - snap.score;
      }

      const usersBehind = Math.max(0, totalUsers - currentRank);

      if (!cancelled) {
        setState({
          rankDelta,
          scoreDelta: Math.round(scoreDelta * 10) / 10,
          usersBehind,
          hasSnapshot,
          loading: false,
        });
      }

      // Refresh snapshot once per day
      if (snapKey !== todayKey) {
        await supabase
          .from("profiles")
          .update({
            last_rank_snapshot: {
              rank: currentRank,
              score: currentScore,
              timestamp: now.toISOString(),
            },
          })
          .eq("user_id", userId);
      }
    };
    void run().catch(() => { /* snapshot is best-effort */ });
    return () => {
      cancelled = true;
    };
  }, [userId, currentRank, currentScore, totalUsers]);

  return state;
};
