
import { Trophy, Lock, Crown, TrendingUp, Clock3, Medal } from "lucide-react";
import StatusAvatar from "@/components/StatusAvatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import PullRefreshIndicator from "@/components/PullRefreshIndicator";
import { useEffect, useMemo, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import { getTierConfig } from "@/lib/status-tiers";
import FeatureGateScreen from "@/components/FeatureGateScreen";
import TopInvitersWidget from "@/components/TopInvitersWidget";

type LeaderRow = {
  username: string;
  xp: number;
  level: number;
  streak: number;
  user_id: string;
  avatar_url: string | null;
  status_tier?: string | null;
  season_points?: number;
};

const BOARD_LIMIT = 50;

const formatCountdown = (endsAt?: string) => {
  if (!endsAt) return "--";
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Season ended";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

const Leaderboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"season" | "all_time">("season");
  const [, setTick] = useState(0);
  const { scrollRef, pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd, PULL_THRESHOLD } = usePullRefresh([
    ["leaderboard-all-time"],
    ["leaderboard-season"],
    ["active-season"],
    ["leaderboard-champions"],
  ]);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const isElite = profile?.is_elite;

  const { data: allTimeLeaders } = useQuery({
    queryKey: ["leaderboard-all-time"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, xp, level, streak, user_id, avatar_url, status_tier")
        .gt("xp", 0)
        .order("xp", { ascending: false })
        .limit(BOARD_LIMIT);
      return (data || []) as LeaderRow[];
    },
  });

  const { data: totalCount } = useQuery({
    queryKey: ["total-users"],
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gt("xp", 0);
      return count || 1;
    },
  });

  const { data: myRealRank } = useQuery({
    queryKey: ["my-rank", profile?.user_id],
    queryFn: async () => {
      if (!profile) return null;
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gt("xp", profile.xp);
      return (count ?? 0) + 1;
    },
    enabled: !!profile,
  });

  const { data: activeSeason } = useQuery({
    queryKey: ["active-season"],
    queryFn: async () => {
      const db = supabase as any;

      await db.rpc("finalize_expired_leaderboard_seasons");

      const nowIso = new Date().toISOString();
      const { data: existing } = await db
        .from("leaderboard_seasons")
        .select("*")
        .eq("status", "active")
        .lte("starts_at", nowIso)
        .gt("ends_at", nowIso)
        .order("starts_at", { ascending: false })
        .limit(1);

      if (existing?.length) return existing[0];

      const { data: ensured } = await db.rpc("ensure_active_leaderboard_season");
      if (Array.isArray(ensured)) return ensured[0];
      return ensured;
    },
  });

  const { data: seasonData } = useQuery({
    queryKey: ["leaderboard-season", activeSeason?.id, profile?.user_id],
    enabled: !!activeSeason?.id,
    queryFn: async () => {
      const db = supabase as any;
      const [{ data: baselines }, { data: profiles }] = await Promise.all([
        db
          .from("leaderboard_season_baselines")
          .select("user_id, baseline_xp")
          .eq("season_id", activeSeason.id),
        supabase
          .from("profiles")
          .select("username, xp, level, streak, user_id, avatar_url, status_tier")
          .gt("xp", 0),
      ]);

      const baselineMap = new Map<string, number>((baselines || []).map((b: any) => [b.user_id, b.baseline_xp]));

      const full = ((profiles || []) as LeaderRow[])
        .map((p) => ({
          ...p,
          season_points: Math.max(p.xp - (baselineMap.get(p.user_id) ?? p.xp), 0),
        }))
        .sort((a, b) => (b.season_points || 0) - (a.season_points || 0) || b.xp - a.xp);

      const myRank = profile?.user_id ? full.findIndex((u) => u.user_id === profile.user_id) + 1 : null;

      return {
        full,
        top: full.slice(0, BOARD_LIMIT),
        myRank: myRank > 0 ? myRank : null,
      };
    },
  });

  const { data: championData } = useQuery({
    queryKey: ["leaderboard-champions"],
    queryFn: async () => {
      const db = supabase as any;
      const [{ data: champions }, { data: seasons }] = await Promise.all([
        db
          .from("leaderboard_champions")
          .select("user_id, username_snapshot, season_points, season_id, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
        db.from("leaderboard_seasons").select("id, name"),
      ]);

      const seasonNames = new Map<string, string>((seasons || []).map((s: any) => [s.id, s.name]));
      const counts: Record<string, number> = {};
      for (const row of champions || []) {
        counts[row.user_id] = (counts[row.user_id] || 0) + 1;
      }

      const recent = (champions || []).slice(0, 6).map((c: any) => ({
        ...c,
        season_name: seasonNames.get(c.season_id) || "Season",
      }));

      return { counts, recent };
    },
  });

  const rankColors: Record<number, string> = {
    0: "text-gold glow-gold-text",
    1: "text-foreground/70",
    2: "text-amber-700",
  };

  const currentLeaders = mode === "season" ? seasonData?.top || [] : allTimeLeaders || [];
  const totalUsersForMode = mode === "season" ? seasonData?.full.length || 1 : totalCount || 1;
  const rank = mode === "season" ? seasonData?.myRank || null : myRealRank || null;
  const percentile = rank ? Math.max(1, Math.round(((totalUsersForMode - rank) / totalUsersForMode) * 100)) : 0;
  const mySeasonWins = profile?.user_id ? championData?.counts?.[profile.user_id] || 0 : 0;

  const countdownText = useMemo(() => formatCountdown(activeSeason?.ends_at), [activeSeason]);

  // Gate: require Performer tier (rank >= 2) OR Elite subscription
  const userTier = (profile?.status_tier || 'recruit') as any;
  const tierRank = getTierConfig(userTier).rank;
  const hasAccess = isElite || tierRank >= 2; // performer+

  if (!hasAccess) {
    return (
      <FeatureGateScreen
        requiredTier="performer"
        currentTier={userTier}
        featureName="Leaderboard"
        description="Reach Performer status by checking in consistently to see global rankings and compete for Season Champion."
        icon={Trophy}
        requiresElite={false}
      />
    );
  }

  return (
    <div
      ref={scrollRef}
      className="min-h-screen pb-4 px-4 pt-6 safe-top"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} threshold={PULL_THRESHOLD} />
      

      <div className="animate-reveal mb-4 relative">
        <div className="absolute -inset-x-8 -top-6 -bottom-6 pointer-events-none -z-10"
             style={{
               background:
                 "radial-gradient(ellipse 90% 70% at 50% 0%, hsl(var(--gold) / 0.22) 0%, transparent 65%)",
             }}
             aria-hidden
        />
        <div className="absolute -inset-x-8 -top-6 h-32 pointer-events-none -z-10 opacity-50 mix-blend-screen"
             style={{
               background:
                 "conic-gradient(from 210deg at 50% 120%, transparent 0deg, hsl(var(--gold) / 0.35) 90deg, transparent 180deg)",
               filter: "blur(28px)",
             }}
             aria-hidden
        />
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Trophy size={26} className="text-gold drop-shadow-[0_0_12px_hsl(var(--gold)/0.6)]" />
            <div className="absolute inset-0 animate-pulse opacity-60">
              <Trophy size={26} className="text-gold blur-[6px]" />
            </div>
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight bg-gradient-to-br from-gold via-amber-200 to-gold bg-clip-text text-transparent">
            Leaderboard
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold animate-pulse shadow-[0_0_8px_hsl(var(--gold))]" />
          Season & all time rankings — climb or fall.
        </p>
      </div>

      {/* Season banner */}
      <div className="animate-reveal animate-reveal-delay-1 relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/[0.12] via-card to-card p-4 mb-4 glow-gold-sm">
        <div
          className="absolute -top-12 -right-8 h-32 w-32 rounded-full opacity-30 blur-2xl pointer-events-none"
          style={{ background: "hsl(var(--gold))" }}
          aria-hidden
        />
        <div className="flex items-center justify-between gap-2 relative">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-gold/80 font-bold">Current Season</p>
            <p className="font-display font-bold text-lg tracking-tight mt-0.5">{activeSeason?.name || "Season"}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-bold">Ends in</p>
            <p className="font-display font-black text-sm text-gold flex items-center justify-end gap-1 tabular-nums mt-0.5">
              <Clock3 size={14} /> {countdownText}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-3 relative flex items-center gap-1.5">
          <Crown size={12} className="text-gold shrink-0" />
          #1 earns <span className="text-gold font-semibold">Season Champion</span> reward + permanent profile badge.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 animate-reveal animate-reveal-delay-1">
        <Button variant={mode === "season" ? "gold" : "outline"} onClick={() => setMode("season")}>Season</Button>
        <Button variant={mode === "all_time" ? "gold" : "outline"} onClick={() => setMode("all_time")}>All Time</Button>
      </div>

      {profile && (
        <div className="animate-reveal animate-reveal-delay-2 relative overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/[0.08] via-card to-card p-4 mb-5 glow-gold-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-gold text-primary-foreground font-display font-black text-base shadow-lg shadow-gold/30">
                #{rank || "?"}
              </div>
              <div>
                <p className="font-display font-bold text-base tracking-tight">Your Position</p>
                <p className="text-xs text-muted-foreground">
                  Ahead of <span className="text-gold font-bold">{percentile}%</span> · {mode === "season" ? "Season" : "All Time"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Season wins: <span className="text-gold font-bold">{mySeasonWins}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge tier={profile.status_tier || 'recruit'} size="sm" showAura={false} />
              <TrendingUp size={16} className="text-gold" />
            </div>
          </div>
          {percentile < 50 && (
            <p className="text-[10px] text-destructive font-bold mt-3 text-center uppercase tracking-wider">⚠️ Falling behind — others are gaining</p>
          )}
          {percentile >= 90 && (
            <p className="text-[10px] text-gold font-bold mt-3 text-center uppercase tracking-wider">🔥 Top {100 - percentile}% — defend your spot</p>
          )}
        </div>
      )}

      {/* Podium — top 3, hero treatment */}
      {currentLeaders.length >= 1 && (
        <div className="relative mb-5 animate-reveal animate-reveal-delay-2">
          {/* Spotlight glow behind #1 */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 w-56 h-56 pointer-events-none -z-10 opacity-70"
            style={{
              background:
                "radial-gradient(circle at 50% 30%, hsl(var(--gold) / 0.35) 0%, transparent 60%)",
              filter: "blur(12px)",
            }}
            aria-hidden
          />
          <div className="grid grid-cols-3 gap-2 items-end">
            {/* #2 */}
            {currentLeaders[1] && (
              <PodiumCard
                user={currentLeaders[1]}
                rank={2}
                points={mode === "season" ? currentLeaders[1].season_points || 0 : currentLeaders[1].xp}
                mode={mode}
                isMe={currentLeaders[1].user_id === profile?.user_id}
                wins={championData?.counts?.[currentLeaders[1].user_id] || 0}
                onClick={() => navigate(`/user/${currentLeaders[1].user_id}`)}
              />
            )}
            {/* #1 */}
            {currentLeaders[0] && (
              <PodiumCard
                user={currentLeaders[0]}
                rank={1}
                points={mode === "season" ? currentLeaders[0].season_points || 0 : currentLeaders[0].xp}
                mode={mode}
                isMe={currentLeaders[0].user_id === profile?.user_id}
                wins={championData?.counts?.[currentLeaders[0].user_id] || 0}
                onClick={() => navigate(`/user/${currentLeaders[0].user_id}`)}
              />
            )}
            {/* #3 */}
            {currentLeaders[2] && (
              <PodiumCard
                user={currentLeaders[2]}
                rank={3}
                points={mode === "season" ? currentLeaders[2].season_points || 0 : currentLeaders[2].xp}
                mode={mode}
                isMe={currentLeaders[2].user_id === profile?.user_id}
                wins={championData?.counts?.[currentLeaders[2].user_id] || 0}
                onClick={() => navigate(`/user/${currentLeaders[2].user_id}`)}
              />
            )}
          </div>
        </div>
      )}

      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">The Chase</p>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        <div className="space-y-1.5">
          {currentLeaders.slice(3).map((user, i) => {
            const points = mode === "season" ? user.season_points || 0 : user.xp;
            const wins = championData?.counts?.[user.user_id] || 0;
            const displayRank = i + 4;
            const isMe = user.user_id === profile?.user_id;
            const isTop10 = displayRank <= 10;

            return (
              <button
                key={user.user_id}
                onClick={() => navigate(`/user/${user.user_id}`)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.99]",
                  isMe
                    ? "border-gold/50 bg-gradient-to-r from-gold/10 via-gold/5 to-transparent ring-1 ring-gold/40 shadow-[0_0_20px_hsl(var(--gold)/0.15)]"
                    : isTop10
                    ? "border-border bg-card hover:border-gold/20"
                    : "border-border/60 bg-card/60"
                )}
              >
                <div className={cn(
                  "shrink-0 h-9 w-9 rounded-lg flex items-center justify-center font-display font-black text-sm tabular-nums",
                  isTop10
                    ? "bg-gold/10 text-gold border border-gold/20"
                    : "bg-secondary text-muted-foreground"
                )}>
                  {displayRank}
                </div>
                <StatusAvatar src={user.avatar_url} name={user.username} tier={user.status_tier || 'recruit'} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold truncate flex items-center gap-1.5", isMe && "text-gold")}>
                    @{user.username}
                    {isMe && <span className="text-[9px] text-gold/70 font-medium">(you)</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] text-muted-foreground">Lvl {user.level}</p>
                    {wins > 0 && (
                      <p className="text-[10px] text-gold/80 flex items-center gap-0.5">
                        <Medal size={9} /> {wins}×
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-display font-black text-sm tabular-nums", isMe && "text-gold")}>
                    {points.toLocaleString()}
                  </p>
                  <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-bold">
                    {mode === "season" ? "S-XP" : "XP"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 animate-reveal animate-reveal-delay-3">
        <TopInvitersWidget />
      </div>

      {championData?.recent?.length ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-4 animate-reveal animate-reveal-delay-3">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-gold" />
            <h2 className="font-display font-bold text-base">Hall of Champions</h2>
          </div>
          <div className="space-y-2">
            {championData.recent.map((row: any) => (
              <div key={`${row.season_id}-${row.user_id}`} className="flex items-center justify-between text-sm">
                <span className="truncate">@{row.username_snapshot || "unknown"}</span>
                <span className="text-muted-foreground ml-2">{row.season_name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

interface PodiumCardProps {
  user: LeaderRow;
  rank: 1 | 2 | 3;
  points: number;
  mode: "season" | "all_time";
  isMe: boolean;
  wins: number;
  onClick: () => void;
}

const PodiumCard = ({ user, rank, points, mode, isMe, wins, onClick }: PodiumCardProps) => {
  const isFirst = rank === 1;
  const isSecond = rank === 2;
  const heightClass = isFirst ? "pt-8 pb-5" : isSecond ? "pt-5 pb-4 mt-6" : "pt-5 pb-3.5 mt-10";
  const rankLabel = isFirst ? "1st" : isSecond ? "2nd" : "3rd";
  const accent = isFirst
    ? "border-gold/70 bg-gradient-to-b from-gold/[0.22] via-gold/[0.08] to-card shadow-[0_8px_32px_-8px_hsl(var(--gold)/0.5)]"
    : isSecond
    ? "border-foreground/30 bg-gradient-to-b from-foreground/[0.1] via-foreground/[0.03] to-card"
    : "border-amber-700/50 bg-gradient-to-b from-amber-700/[0.14] via-amber-700/[0.05] to-card";

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative rounded-2xl border overflow-visible flex flex-col items-center px-2 text-center transition-transform active:scale-[0.97]",
        heightClass,
        accent,
        isMe && "ring-2 ring-gold/60",
      )}
    >
      {/* Floating crown for #1 */}
      {isFirst && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="relative">
            <Crown size={28} className="text-gold drop-shadow-[0_0_12px_hsl(var(--gold)/0.9)] animate-[float_3s_ease-in-out_infinite]" />
            <div className="absolute inset-0 blur-md opacity-70 animate-pulse">
              <Crown size={28} className="text-gold" />
            </div>
          </div>
        </div>
      )}

      {/* Soft gold gradient halo for #1 */}
      {isFirst && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-60"
          aria-hidden
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--gold) / 0.15) 0%, transparent 45%, transparent 55%, hsl(var(--gold) / 0.1) 100%)",
          }}
        />
      )}

      <div className={cn("absolute top-2 right-2 font-display font-black text-[10px] tabular-nums uppercase tracking-wider",
        isFirst ? "text-gold" : isSecond ? "text-foreground/60" : "text-amber-600"
      )}>
        {rankLabel}
      </div>

      <div className={cn("relative", isFirst && "scale-110")}>
        {isFirst && (
          <div
            className="absolute inset-0 rounded-full blur-xl opacity-60 animate-pulse"
            style={{ background: "hsl(var(--gold) / 0.6)" }}
            aria-hidden
          />
        )}
        <div className="relative">
          <StatusAvatar
            src={user.avatar_url}
            name={user.username}
            tier={user.status_tier || "recruit"}
            size={isFirst ? "md" : "sm"}
          />
        </div>
      </div>

      <p className={cn(
        "font-display font-bold text-xs mt-2 truncate max-w-full px-1",
        isMe && "text-gold",
      )}>
        @{user.username}
      </p>
      {isMe && <span className="text-[9px] text-gold/70 font-medium -mt-0.5">(you)</span>}
      <p className={cn(
        "font-display font-black tabular-nums mt-1",
        isFirst ? "text-gold text-xl" : "text-foreground text-sm",
      )}>
        {points.toLocaleString()}
      </p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
        {mode === "season" ? "Season XP" : "XP"}
      </p>
      {wins > 0 && (
        <p className="text-[9px] text-gold/80 mt-1 flex items-center gap-0.5">
          <Medal size={9} /> {wins}×
        </p>
      )}
    </button>
  );
};

export default Leaderboard;
