import { useEffect, useMemo, useState } from "react";
import { DetailSkeleton } from "@/components/skeletons/PageSkeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Crown, Medal, Award, Trophy, Loader2, Users, Lock, Zap } from "lucide-react";
import TribeFireLite from "@/components/TribeFireLite";
import EmptyState from "@/components/ui/empty-state";
import {
  collectiveAccent,
  tierPalette,
  collectiveStreakTier,
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
      const { data, error } = await supabase.rpc("get_tribe_leaderboard" as any, {
        p_period: period,
        p_limit: 50,
      });
      if (!error && data) {
        const normalized = (data as any[]).map((r) => ({
          ...r,
          score: Number(r.score) || 0,
          rank: Number(r.rank) || 0,
          member_count: Number(r.member_count) || 0,
        }));
        setRows(normalized);
        // Hydrate collective streaks for top tribes — drives the flame size/tier.
        const ids = normalized.slice(0, 10).map((r) => r.tribe_id);
        if (ids.length > 0) {
          const m = await fetchTribeCollectiveStreaks(ids);
          setStreaksMap(m);
        }
      }
      if (profile?.user_id) {
        const { data: mems } = await supabase
          .from("tribe_members")
          .select("tribe_id")
          .eq("user_id", profile.user_id)
          .eq("status", "active");
        setMyTribeIds(new Set(((mems as any) ?? []).map((m: any) => m.tribe_id)));
      }
      setLoading(false);
    };
    if (profile?.user_id) load();
  }, [period, profile?.user_id]);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  const myBest = useMemo(() => {
    return rows.find((r) => myTribeIds.has(r.tribe_id)) ?? null;
  }, [rows, myTribeIds]);

  const formatScore = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : `${n}`;

  return (
    <div className="min-h-full pb-32 px-4 pt-4">
      <button
        onClick={() => navigate("/squad?tab=tribes")}
        className="flex items-center gap-1 text-xs text-muted-foreground mb-4"
      >
        <ArrowLeft size={14} /> Tribes
      </button>

      {/* Hero */}
      <div className="relative rounded-2xl mb-5 p-[2px] overflow-hidden"
        style={{
          background: "conic-gradient(from 180deg at 50% 50%, hsl(var(--gold) / 0.7), hsl(var(--ember) / 0.5), hsl(var(--gold) / 0.7))",
        }}
      >
        <div className="rounded-2xl p-5 bg-gradient-to-br from-[hsl(var(--ember))]/12 via-card/85 to-gold/10 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/40 backdrop-blur-sm border border-gold/50 mb-2">
            <Trophy size={11} className="text-gold" strokeWidth={2.6} />
            <span className="text-[10px] font-black tracking-widest uppercase text-gold">
              Tribe Leaderboard
            </span>
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight leading-none">
            <span className="bg-gradient-to-r from-[hsl(var(--ember))] via-gold to-[hsl(var(--ember))] bg-clip-text text-transparent">
              Top Tribes
            </span>
          </h1>
          <p className="text-[11px] text-foreground/70 mt-1">
            Ranked by collective XP earned by members
          </p>
        </div>
      </div>

      {/* Period tabs */}
      <div className="flex gap-2 mb-5 p-1 rounded-xl bg-secondary/40">
        {(["weekly", "all_time"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              "flex-1 text-xs font-black py-2 rounded-lg uppercase tracking-wider transition-all",
              period === p ? "bg-background text-foreground shadow" : "text-muted-foreground",
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
        <>
          {/* Top 3 */}
          <div className="space-y-3 mb-5">
            {top3.map((r) => {
              const podium = r.rank === 1
                ? { Icon: Crown, color: "hsl(var(--gold))", label: "Gold", glow: 0.55 }
                : r.rank === 2
                ? { Icon: Medal, color: "hsl(0 0% 78%)", label: "Silver", glow: 0.4 }
                : { Icon: Award, color: "hsl(28 60% 52%)", label: "Bronze", glow: 0.4 };
              const { Icon } = podium;
              const mine = myTribeIds.has(r.tribe_id);
              return (
                <button
                  key={r.tribe_id}
                  onClick={() => navigate(`/tribes/${r.tribe_id}`)}
                  className="group w-full text-left rounded-2xl p-[1.5px] overflow-hidden transition-transform active:scale-[0.99]"
                  style={{
                    background: `linear-gradient(135deg, ${podium.color}, ${podium.color}40)`,
                    boxShadow: `0 0 22px ${podium.color.replace(")", ` / ${podium.glow})`)}`,
                  }}
                >
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-card/90 via-card/80 to-card/70 flex items-center gap-3">
                    {(() => {
                      // #1 = the biggest, hottest tribe flame in the app.
                      // Size & tier scale visibly with rank, and the flame's
                      // tier is driven by collective member streak so the
                      // top tribe literally burns hotter than the rest.
                      const isFirst = r.rank === 1;
                      const collective = streaksMap.get(r.tribe_id) ?? 0;
                      const flameTier = Math.max(
                        0,
                        Math.min(5, collectiveStreakTier(collective)),
                      );
                      const flameAccent = collectiveAccent(collective);
                      const containerSize = isFirst ? "h-20 w-20" : r.rank === 2 ? "h-16 w-16" : "h-14 w-14";
                      const flameSize = isFirst ? 72 : r.rank === 2 ? 54 : 46;
                      return (
                        <div
                          className={cn(
                            "relative rounded-xl flex items-center justify-center shrink-0 border overflow-hidden",
                            containerSize,
                          )}
                          style={{
                            background: `linear-gradient(135deg, ${podium.color}30, ${podium.color}10)`,
                            borderColor: `${podium.color}60`,
                            boxShadow: isFirst
                              ? `inset 0 -10px 22px ${flameAccent.replace(")", " / 0.35)")}, 0 0 18px ${flameAccent.replace(")", " / 0.45)")}`
                              : undefined,
                          }}
                        >
                          <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
                            <TribeFireLite
                              tier={isFirst ? Math.max(flameTier, 4) : flameTier}
                              palette={tierPalette(isFirst ? Math.max(flameTier, 4) : flameTier)}
                              variant={isFirst ? "hero" : "standard"}
                              size={flameSize}
                            />
                          </div>
                          <Icon
                            size={isFirst ? 26 : 22}
                            style={{ color: podium.color }}
                            strokeWidth={2.4}
                            className="relative z-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]"
                          />
                        </div>
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[10px] font-black tracking-widest uppercase"
                          style={{ color: podium.color }}
                        >
                          #{r.rank}
                        </span>
                        {r.visibility === "private" && (
                          <Lock size={9} className="text-muted-foreground" />
                        )}
                        {mine && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-gold/20 text-gold font-black uppercase tracking-widest">
                            Mine
                          </span>
                        )}
                      </div>
                      <p className="font-display font-black text-base truncate leading-tight">
                        {r.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users size={9} /> {r.member_count}
                        </span>
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-black tabular-nums"
                          style={{ color: podium.color }}
                        >
                          <Zap size={10} fill="currentColor" strokeWidth={0} />
                          {formatScore(r.score)} XP
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Rest list */}
          {rest.length > 0 && (
            <div className="rounded-2xl border border-border bg-card/40 divide-y divide-border/50 overflow-hidden">
              {rest.map((r) => {
                const mine = myTribeIds.has(r.tribe_id);
                return (
                  <button
                    key={r.tribe_id}
                    onClick={() => navigate(`/tribes/${r.tribe_id}`)}
                    className={cn(
                      "w-full text-left px-3 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors",
                      mine && "bg-gold/5",
                    )}
                  >
                    <span className="w-7 text-center text-[11px] font-black tabular-nums text-muted-foreground">
                      {r.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-black truncate">{r.name}</p>
                        {r.visibility === "private" && (
                          <Lock size={9} className="text-muted-foreground shrink-0" />
                        )}
                        {mine && (
                          <span className="text-[8px] px-1 rounded bg-gold/20 text-gold font-black uppercase tracking-widest shrink-0">
                            Mine
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Users size={9} /> {r.member_count}
                      </span>
                    </div>
                    <span className="text-xs font-black tabular-nums text-gold">
                      {formatScore(r.score)} XP
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Sticky my-tribe footer */}
      {myBest && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-30 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={() => navigate(`/tribes/${myBest.tribe_id}`)}
              className="w-full rounded-xl p-3 border border-gold/40 bg-background/85 backdrop-blur-md flex items-center gap-3 shadow-[0_0_18px_hsl(var(--gold)/0.3)]"
            >
              <span className="text-[10px] font-black tracking-widest uppercase text-gold shrink-0">
                Your tribe
              </span>
              <span className="font-black text-sm truncate flex-1 text-left">
                #{myBest.rank} · {myBest.name}
              </span>
              <span className="text-xs font-black tabular-nums text-gold">
                {formatScore(myBest.score)} XP
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TribeLeaderboard;
