import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * A live battle's scoreboard from the server (`battle_scores`): each side's
 * total and per-day values for the battle's own metric, computed from that
 * member's own check-ins or Apple Health rows. Nothing else about the
 * opponent crosses the wire. Refetched every minute while the arena is open.
 */
export interface BattleSide {
  user_id: string;
  total: number;
  days: { d: string; v: number; verified: boolean }[];
}

export interface BattleScoreboard {
  battle_id: string;
  status: string;
  battle_type?: string;
  start_date?: string;
  end_date?: string;
  challenger?: BattleSide;
  opponent?: BattleSide;
}

export const battleScoresKey = (battleId: string | null | undefined) => ["battle-scores", battleId] as const;

export const useBattleScores = (battleId: string | null | undefined, enabled = true) =>
  useQuery({
    queryKey: battleScoresKey(battleId),
    enabled: !!battleId && enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<BattleScoreboard> => {
      const { data, error } = await supabase.rpc("battle_scores", { p_battle_id: battleId! });
      if (error) throw error;
      const raw = data as unknown as BattleScoreboard;
      const side = (s?: BattleSide): BattleSide | undefined =>
        s ? { ...s, total: Number(s.total), days: (s.days ?? []).map((d) => ({ ...d, v: Number(d.v) })) } : undefined;
      return { ...raw, challenger: side(raw.challenger), opponent: side(raw.opponent) };
    },
  });
