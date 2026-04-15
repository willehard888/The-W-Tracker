import AppLogoHeader from "@/components/AppLogoHeader";
import { Trophy, Lock, Crown, TrendingUp, Clock3, Medal } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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

type LeaderRow = {
  username: string;
  xp: number;
  level: number;
  streak: number;
  user_id: string;
  avatar_url: string | null;
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
        .select("username, xp, level, streak, user_id, avatar_url")
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
          .select("username, xp, level, streak, user_id, avatar_url")
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
        description="Reach Performer status or go Elite to see global rankings and compete for Season Champion."
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
      <AppLogoHeader />

      <div className="animate-reveal mb-4">
        <h1 className="font-display text-3xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Season & all time rankings in one view.</p>
      </div>

      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-gold/30 bg-gold/5 p-4 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Current season</p>
            <p className="font-semibold text-base">{activeSeason?.name || "Season"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Ends in</p>
            <p className="font-display font-bold text-sm text-gold flex items-center justify-end gap-1">
              <Clock3 size={14} /> {countdownText}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">#1 earns Season Champion reward + permanent profile badge.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 animate-reveal animate-reveal-delay-1">
        <Button variant={mode === "season" ? "gold" : "outline"} onClick={() => setMode("season")}>Season</Button>
        <Button variant={mode === "all_time" ? "gold" : "outline"} onClick={() => setMode("all_time")}>All Time</Button>
      </div>

      {profile && (
        <div className="animate-reveal animate-reveal-delay-2 rounded-xl border border-gold/30 bg-gold/5 p-4 mb-4 glow-gold-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/15 text-gold font-display font-bold">
                #{rank || "?"}
              </div>
              <div>
                <p className="font-semibold text-base">Your Position ({mode === "season" ? "Season" : "All Time"})</p>
                <p className="text-sm text-muted-foreground">
                  You're ahead of <span className="text-gold font-semibold">{percentile}%</span> of users
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Season wins: <span className="text-gold font-semibold">{mySeasonWins}</span></p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge tier={profile.status_tier || 'recruit'} size="sm" showAura={false} />
              <TrendingUp size={16} className="text-gold" />
            </div>
          </div>
          {percentile < 50 && (
            <p className="text-[10px] text-destructive font-semibold mt-2 text-center">⚠️ You're falling behind. Others are gaining.</p>
          )}
          {percentile >= 90 && (
            <p className="text-[10px] text-emerald-400 font-semibold mt-2 text-center">🔥 You're in the top {100 - percentile}%. Don't lose it.</p>
          )}
        </div>
      )}

      <div className="space-y-2 animate-reveal animate-reveal-delay-2">
        {currentLeaders.slice(0, 3).map((user, i) => {
          const points = mode === "season" ? user.season_points || 0 : user.xp;
          const wins = championData?.counts?.[user.user_id] || 0;

          return (
            <div
              key={user.user_id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4",
                i === 0 ? "border-gold/30 bg-card glow-gold-sm" : "border-border bg-card",
                user.user_id === profile?.user_id && "ring-1 ring-gold/40 bg-gold/5"
              )}
            >
              <div className={cn("font-display font-black text-xl w-8 text-center tabular-nums", rankColors[i] || "text-muted-foreground")}>
                {i === 0 ? <Crown size={22} className="text-gold mx-auto" /> : i + 1}
              </div>
              <Avatar className="h-9 w-9 shrink-0">
                {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.username} /> : null}
                <AvatarFallback className={cn("text-xs font-bold", i === 0 ? "bg-gold/20 text-gold" : "bg-secondary")}>
                  {user.username?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => navigate(`/user/${user.user_id}`)}
                  className={cn("text-base font-semibold truncate hover:underline text-left", user.user_id === profile?.user_id && "text-gold")}
                >
                  @{user.username} {user.user_id === profile?.user_id && <span className="text-[10px] text-gold/70 font-medium">(you)</span>}
                </button>
                <p className="text-sm text-muted-foreground">Level {user.level} • {user.streak}d streak</p>
                {wins > 0 && (
                  <p className="text-[11px] text-gold/80 mt-0.5 flex items-center gap-1">
                    <Medal size={12} /> {wins}x Season Champion
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className={cn("font-display font-bold text-sm tabular-nums", i === 0 && "text-gold")}>{points.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{mode === "season" ? "Season XP" : "XP"}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        <div className="space-y-2">
          {currentLeaders.slice(3).map((user, i) => {
            const points = mode === "season" ? user.season_points || 0 : user.xp;
            const wins = championData?.counts?.[user.user_id] || 0;

            return (
              <div
                key={user.user_id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4",
                  user.user_id === profile?.user_id ? "border-gold/30 bg-gold/5 ring-1 ring-gold/40" : "border-border bg-card"
                )}
              >
                <div className="font-display font-black text-xl w-8 text-center text-muted-foreground tabular-nums">{i + 4}</div>
                <Avatar className="h-8 w-8 shrink-0">
                  {user.avatar_url ? <AvatarImage src={user.avatar_url} alt={user.username} /> : null}
                  <AvatarFallback className="text-xs font-bold bg-secondary">{user.username?.charAt(0)?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => navigate(`/user/${user.user_id}`)}
                    className={cn("text-sm font-semibold hover:underline text-left truncate", user.user_id === profile?.user_id && "text-gold")}
                  >
                    @{user.username} {user.user_id === profile?.user_id && <span className="text-[10px] text-gold/70 font-medium">(you)</span>}
                  </button>
                  <p className="text-xs text-muted-foreground">Level {user.level}</p>
                  {wins > 0 && <p className="text-[11px] text-gold/80">{wins}x Champion</p>}
                </div>
                <p className="font-display font-bold text-sm tabular-nums">{points.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
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

export default Leaderboard;
