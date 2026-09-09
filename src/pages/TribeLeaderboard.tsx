import { fmtInt } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Crown, Users, Lock, Zap, Flame } from "lucide-react";
import PageBar from "@/components/ui/page-bar";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import { SEGMENT_TRACK, SEGMENT_ACTIVE, SEGMENT_IDLE } from "@/components/ui/segment";
import { backOr } from "@/lib/nav";
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

// Podium colours: gold, silver, bronze. Everything else stays neutral, so
// the top three are the only colour the list carries.
const PODIUM: Record<number, string> = {
  1: "text-gold",
  2: "text-[hsl(220_9%_74%)]",
  3: "text-[hsl(28_58%_52%)]",
};

const LABEL = "text-[11px] font-bold text-muted-foreground";

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

  const span = period === "weekly" ? "this week" : "all-time";

  const fireChip = (tribeId: string) => {
    const streak = streaksMap.get(tribeId) ?? 0;
    const tier = collectiveStreakTier(streak);
    if (tier < 0) return null; // cold tribes carry no flame — honest
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums"
        style={{ color: collectiveAccent(streak) }}
      >
        <Flame size={12} fill="currentColor" strokeWidth={0} aria-hidden />
        {fmtInt(streak)}d · {collectiveTierName(streak)}
      </span>
    );
  };

  return (
    <div className="min-h-full">
      <PageBar title="Tribe leaderboard" onBack={() => backOr(navigate, "/squad?tab=tribes")} />
      {/* pb-32 clears this page's fixed "your tribe" footer. */}
      <div className="px-4 pt-3 pb-32">
      <header className="home-rise">
        <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
          {myBest ? <>Your tribe is <span className="text-gold glow-gold-text tabular-nums">#{myBest.rank}</span> {span}.</> : "Every tribe, ranked."}
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {period === "weekly" ? "By XP earned this week" : "By all-time XP"}
        </p>
      </header>

      {/* Period segment */}
      <div className={cn("home-rise home-rise-1", SEGMENT_TRACK, "mt-4 mb-4")}>
        {(["weekly", "all_time"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              "flex-1 min-h-11 rounded-lg text-[12px] font-bold transition-colors",
              period === p ? SEGMENT_ACTIVE : SEGMENT_IDLE,
            )}
          >
            {p === "weekly" ? "Weekly XP" : "All-time XP"}
          </button>
        ))}
      </div>

      <div className="home-rise home-rise-2">
      {loading ? (
        <div className="divide-y divide-border/35 border-t border-border/35">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="py-3"><div className="h-9 rounded-lg skeleton-block bg-secondary/30" /></div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No tribes yet"
          description="Be the first founder. Start one and rally your circle."
          action={
            <Button variant="ember" className="min-h-11" onClick={() => navigate("/tribes/new")}>
              Start a tribe
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-border/35 border-t border-border/35">
          {rows.map((r) => {
            const mine = myTribeIds.has(r.tribe_id);
            return (
              <button
                key={r.tribe_id}
                type="button"
                onClick={() => navigate(`/tribes/${r.tribe_id}`)}
                className="press w-full min-h-11 text-left py-3 flex items-center gap-3"
              >
                <span className={cn("relative w-8 shrink-0 text-right font-display font-black text-base tabular-nums", PODIUM[r.rank] ?? "text-muted-foreground")}>
                  {r.rank === 1 && (
                    <Crown size={11} className="absolute -top-2.5 right-0.5 text-gold" strokeWidth={2.6} fill="currentColor" aria-hidden />
                  )}
                  {r.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-[15px] truncate leading-tight">{r.name}</p>
                    {r.visibility === "private" && (
                      <Lock size={12} className="text-muted-foreground shrink-0" aria-label="Private tribe" />
                    )}
                    {mine && <span className="text-[10px] font-bold text-muted-foreground shrink-0">Mine</span>}
                  </div>
                  <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold tabular-nums text-muted-foreground">
                      <Users size={11} aria-hidden /> {r.member_count}
                    </span>
                    {fireChip(r.tribe_id)}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[13px] font-black tabular-nums shrink-0 text-foreground/85">
                  <Zap size={11} fill="currentColor" strokeWidth={0} aria-hidden />
                  {fmtInt(r.score)}
                </span>
              </button>
            );
          })}
        </div>
      )}
      </div>

      {/* Sticky my-tribe footer: solid tint, no blur over a scrolling list. */}
      {myBest && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-30 pointer-events-none">
          <div className="home-rise home-rise-3 max-w-md mx-auto pointer-events-auto">
            <button
              type="button"
              onClick={() => navigate(`/tribes/${myBest.tribe_id}`)}
              className="w-full min-h-11 rounded-xl px-3 py-2.5 border border-gold/40 bg-[hsl(var(--background)/0.96)] shadow-[var(--shadow-3)] flex items-center gap-3"
            >
              <span className={cn(LABEL, "shrink-0")}>Your tribe</span>
              <span className="font-bold text-sm truncate flex-1 text-left tabular-nums">
                #{myBest.rank} · {myBest.name}
              </span>
              <span className="inline-flex items-center gap-1 text-[13px] font-black tabular-nums text-foreground/85 shrink-0">
                <Zap size={11} fill="currentColor" strokeWidth={0} aria-hidden />
                {fmtInt(myBest.score)}
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
