import { useEffect, useMemo, useState } from "react";
import { DetailSkeleton } from "@/components/skeletons/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Crown, Users, Lock, Zap, Flame } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import EmptyState from "@/components/ui/empty-state";
import { SEGMENT_TRACK, SEGMENT_ACTIVE, SEGMENT_IDLE } from "@/components/ui/segment";
import {
  collectiveAccent,
  collectiveStreakTier,
  collectiveTierName,
  fetchTribeCollectiveStreaks,
} from "@/lib/tribe-streak";
import { cn } from "@/lib/utils";

interface Row {
  tribe_id: string;
  name: string;
  slug: string;
  cover_url: string | null;
  visibility: string;
  member_count: number;
  score: number;
  rank: number;
}

// Podium accents — gold / silver / bronze. Everything else is neutral.
const podiumColor = (rank: number): string | null =>
  rank === 1 ? "hsl(var(--gold))"
  : rank === 2 ? "hsl(220 9% 74%)"
  : rank === 3 ? "hsl(28 58% 52%)"
  : null;

const TribeLeaderboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<"weekly" | "all_time">("weekly");
  const [rows, setRows] = useState<Row[]>([]);
  const [myTribeIds, setMyTribeIds] = useState<Set<string>>(new Set());
  const [streaksMap, setStreaksMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_tribe_leaderboard", {
        p_period: period,
        p_limit: 50,
      });
      if (!error && data) {
        const normalized = data.map((r) => ({
          ...r,
          score: Number(r.score) || 0,
          rank: Number(r.rank) || 0,
          member_count: Number(r.member_count) || 0,
        }));
        setRows(normalized);
        // Collective streaks now live on tribes.collective_streak — one cheap
        // read hydrates the honest fire chip for every row.
        const ids = normalized.map((r) => r.tribe_id);
        if (ids.length > 0) setStreaksMap(await fetchTribeCollectiveStreaks(ids));
      }
      if (profile?.user_id) {
        const { data: mems } = await supabase
          .from("tribe_members")
          .select("tribe_id")
          .eq("user_id", profile.user_id)
          .eq("status", "active");
        setMyTribeIds(new Set((mems ?? []).map((m) => m.tribe_id)));
      }
      setLoading(false);
    };
    if (profile?.user_id) load();
  }, [period, profile?.user_id]);

  const myBest = useMemo(
    () => rows.find((r) => myTribeIds.has(r.tribe_id)) ?? null,
    [rows, myTribeIds],
  );

  const formatScore = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : `${n}`;

  const RankTile = ({ rank }: { rank: number }) => {
    const c = podiumColor(rank);
    return (
      <div
        className="relative h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border tabular-nums"
        style={{
          borderColor: c ? c.replace(")", " / 0.5)") : "hsl(var(--border))",
          background: c ? c.replace(")", " / 0.08)") : "hsl(var(--secondary) / 0.4)",
        }}
      >
        {rank === 1 && (
          <Crown
            size={12}
            className="absolute -top-1.5 left-1/2 -translate-x-1/2"
            style={{ color: "hsl(var(--gold))" }}
            strokeWidth={2.6}
            fill="currentColor"
          />
        )}
        <span
          className="font-display font-black text-sm"
          style={{ color: c ?? "hsl(var(--muted-foreground))" }}
        >
          {rank}
        </span>
      </div>
    );
  };

  const fireChip = (tribeId: string) => {
    const streak = streaksMap.get(tribeId) ?? 0;
    const tier = collectiveStreakTier(streak);
    if (tier < 0) return null; // cold tribes carry no flame — honest
    const accent = collectiveAccent(streak);
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums"
        style={{ color: accent }}
      >
        <Flame size={12} fill="currentColor" strokeWidth={0} />
        {streak.toLocaleString()}d · {collectiveTierName(streak)}
      </span>
    );
  };

  return (
    <div className="min-h-full">
      <PageBar title="Tribe leaderboard" onBack={() => navigate("/squad?tab=tribes")} />
      {/* pb-32 clears this page's fixed "your tribe" footer. */}
      <div className="px-4 pt-4 pb-32">
      <p className="text-[13px] text-muted-foreground mb-4">
        {period === "weekly" ? "Ranked by XP earned this week" : "Ranked by all-time XP"}
      </p>

      {/* Period segment */}
      <div className={cn(SEGMENT_TRACK, "mb-4")}>
        {(["weekly", "all_time"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "flex-1 text-xs font-black py-2 rounded-lg uppercase tracking-wider transition-all",
              period === p ? SEGMENT_ACTIVE : SEGMENT_IDLE,
            )}
          >
            {p === "weekly" ? "Weekly XP" : "All-Time XP"}
          </button>
        ))}
      </div>

      {loading ? (
        <DetailSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No tribes yet"
          description="Be the first founder — start one and rally your circle."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const mine = myTribeIds.has(r.tribe_id);
            const c = podiumColor(r.rank);
            return (
              <button
                key={r.tribe_id}
                onClick={() => navigate(`/tribes/${r.tribe_id}`)}
                className={cn(
                  "w-full text-left surface-card p-3 flex items-center gap-3 apex-tribe-card-hover",
                  mine && "border-gold/40 bg-gold/[0.05]",
                )}
                style={c ? { borderColor: c.replace(")", " / 0.35)") } : undefined}
              >
                <RankTile rank={r.rank} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-[15px] truncate leading-tight">{r.name}</p>
                    {r.visibility === "private" && (
                      <Lock size={12} className="text-muted-foreground shrink-0" />
                    )}
                    {mine && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-gold/20 text-gold font-black uppercase tracking-widest shrink-0">
                        Mine
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-muted-foreground">
                      <Users size={11} /> {r.member_count}
                    </span>
                    {fireChip(r.tribe_id)}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[13px] font-black tabular-nums text-gold shrink-0">
                  <Zap size={11} fill="currentColor" strokeWidth={0} />
                  {formatScore(r.score)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sticky my-tribe footer */}
      {myBest && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-30 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={() => navigate(`/tribes/${myBest.tribe_id}`)}
              className="w-full rounded-xl p-3 border border-gold/40 bg-background/85 backdrop-blur-md flex items-center gap-3 shadow-[0_0_18px_hsl(var(--gold)/0.3)]"
            >
              <span className="eyebrow text-gold shrink-0">Your tribe</span>
              <span className="font-bold text-sm truncate flex-1 text-left">
                #{myBest.rank} · {myBest.name}
              </span>
              <span className="inline-flex items-center gap-1 text-[13px] font-black tabular-nums text-gold shrink-0">
                <Zap size={11} fill="currentColor" strokeWidth={0} />
                {formatScore(myBest.score)}
              </span>
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default TribeLeaderboard;
