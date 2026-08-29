
import { Trophy, Lock, Crown, TrendingUp, Clock3, Medal, Swords, ShieldCheck, AlertTriangle, Flame } from "lucide-react";
import StatusAvatar from "@/components/StatusAvatar";
import TierUsername from "@/components/TierUsername";
import { cn } from "@/lib/utils";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import PullRefreshIndicator from "@/components/PullRefreshIndicator";
import { useEffect, useMemo, useRef, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import TopInvitersWidget from "@/components/TopInvitersWidget";
import TopTribesWidget from "@/components/TopTribesWidget";
import MoreSection from "@/components/ui/more-section";
import { Button } from "@/components/ui/button";
import { BoardRowsSkeleton } from "@/components/skeletons/PageSkeleton";
import StreakFlameInline from "@/components/StreakFlameInline";
import { useMyRank } from "@/hooks/use-my-rank";
import { hapticSelection } from "@/lib/haptics";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AnimatedNumber from "@/components/AnimatedNumber";
import EmptyState from "@/components/ui/empty-state";

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

/**
 * Isolated countdown timer — only this tiny component re-renders every second,
 * not the entire Leaderboard page. Previously a global setInterval + setTick
 * caused the whole page to re-render 60× per minute.
 */
const CountdownTimer = ({ endsAt }: { endsAt?: string }) => {
  const [text, setText] = useState(() => formatCountdown(endsAt));
  useEffect(() => {
    setText(formatCountdown(endsAt));
    const id = setInterval(() => setText(formatCountdown(endsAt)), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return <span>{text}</span>;
};

const Leaderboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"season" | "all_time">("season");
  const { scrollRef, pullDistance, isRefreshing, onTouchStart: pullStart, onTouchMove: pullMove, onTouchEnd: pullEnd, PULL_THRESHOLD } = usePullRefresh([
    ["leaderboard-all-time"],
    ["leaderboard-season"],
    ["active-season"],
    ["leaderboard-champions"],
  ]);

  // Touch handlers — pull-to-refresh + horizontal swipe to switch Season/All-time.
  // Detection runs during touchMOVE (fires mid-gesture) rather than on touchEnd,
  // because on iOS a swipe with any vertical drift ends as `touchcancel` (not
  // touchend), so an end-delta check silently never runs. We trigger as soon as
  // the gesture is clearly horizontal — dominant over vertical, so it never
  // fights the vertical scroll or pull-to-refresh.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swipeFired = useRef(false);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipe.current = t ? { x: t.clientX, y: t.clientY } : null;
    swipeFired.current = false;
    pullStart(e);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    pullMove(e);
    const s = swipe.current;
    const t = e.touches[0];
    if (!s || !t || swipeFired.current) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      swipeFired.current = true;
      setMode(dx < 0 ? "all_time" : "season"); // left → All time, right → Season
      hapticSelection();
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    pullEnd();
    swipe.current = null;
  };


  // Countdown ticking moved to <CountdownTimer> — only that component re-renders.

  const isElite = profile?.status_tier === 'elite'; // EARNED tier, not the paid flag

  const { data: allTimeLeaders, isLoading: allTimeLoading } = useQuery({
    queryKey: ["leaderboard-all-time"],
    staleTime: 5 * 60_000,   // leaderboard refreshes every 5 min is more than enough
    gcTime:    15 * 60_000,
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
    staleTime: 30 * 60_000,  // user count barely changes
    gcTime:    60 * 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gt("xp", 0);
      return count || 1;
    },
  });

  const { data: myRankData } = useMyRank(profile?.user_id);

  const { data: activeSeason } = useQuery({
    queryKey: ["active-season"],
    staleTime: 10 * 60_000,
    gcTime:    30 * 60_000,
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

  const { data: seasonData, isLoading: seasonLoading } = useQuery({
    queryKey: ["leaderboard-season", activeSeason?.id, profile?.user_id],
    enabled: !!activeSeason?.id,
    staleTime: 5 * 60_000,
    gcTime:    15 * 60_000,
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
          .gt("xp", 0)
          // PostgREST silently truncates at 1000 rows with an ARBITRARY subset
          // when unordered. Order by xp so the truncation keeps the top players
          // (season points derive from xp deltas, so high-xp covers the board).
          .order("xp", { ascending: false })
          .limit(2000),
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
        myRank: myRank && myRank > 0 ? myRank : null,
      };
    },
  });

  const { data: championData } = useQuery({
    queryKey: ["leaderboard-champions"],
    staleTime: 30 * 60_000,  // champion history doesn't change mid-session
    gcTime:    60 * 60_000,
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
  // All-Time "Your Position" derives from the SAME XP-ordered list the board
  // shows — the rank_score-based RPC could say "#7" while the user's own
  // highlighted row sat at #12 on the very same screen. RPC stays as the
  // fallback for users deeper than the visible board.
  const myAllTimeIdx = profile?.user_id
    ? (allTimeLeaders ?? []).findIndex((u) => u.user_id === profile.user_id)
    : -1;
  const rank = mode === "season"
    ? seasonData?.myRank || null
    : myAllTimeIdx >= 0 ? myAllTimeIdx + 1 : myRankData?.rank || null;

  // HealthKit-verified leaders — unfakeable discipline shown as status on the
  // board. Reuses the same `verified_authors` RPC the feed uses.
  const verifiedIds = useMemo(() => currentLeaders.map((u) => u.user_id), [currentLeaders]);
  const { data: verifiedSet } = useQuery({
    queryKey: ["leaderboard-verified", verifiedIds],
    enabled: verifiedIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("verified_authors", { p_ids: verifiedIds });
      if (error) return new Set<string>();
      return new Set((data as string[]) ?? []);
    },
  });
  const percentile = rank
    ? Math.max(1, Math.round(((totalUsersForMode - rank) / totalUsersForMode) * 100))
    : mode === "season" ? 0 : Math.round(myRankData?.percentile ?? 0);
  const hasRank = mode === "season" ? Boolean(rank) : (myAllTimeIdx >= 0 || Boolean(myRankData?.hasRank));
  const mySeasonWins = profile?.user_id ? championData?.counts?.[profile.user_id] || 0 : 0;

  // countdownText replaced by <CountdownTimer> component — see render below.

  // Access is gated globally by AccessGate (€4.99/mo membership or 7-day trial).
  // Leaderboard is open to every member with active access.

  return (
    <div
      ref={scrollRef}
      className="min-h-full pb-4 px-4 pt-6"
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
            <Trophy aria-hidden size={26} className="text-gold drop-shadow-[0_0_12px_hsl(var(--gold)/0.6)]" />
            <div className="absolute inset-0 animate-pulse opacity-60">
              <Trophy aria-hidden size={26} className="text-gold blur-[6px]" />
            </div>
          </div>
          {/* Title matches the tab that brought you here ("Ranks") — a tab
              labeled one thing landing on a page titled another reads lost. */}
          <h1 className="font-display text-2xl font-black tracking-tight bg-gradient-to-br from-gold via-gold-light to-gold bg-clip-text text-transparent">
            Ranks
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold animate-pulse shadow-[0_0_8px_hsl(var(--gold))]" />
          Season & all time rankings — climb or fall.
        </p>
      </div>

      {/* 1v1 Battles — friend challenges live under Ranks (no orphan route) */}
      <button
        onClick={() => navigate("/battles")}
        className="animate-reveal mb-5 w-full text-left surface-card p-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
      >
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[hsl(22_90%_52%)] to-[hsl(12_88%_46%)] flex items-center justify-center shrink-0">
          <Swords aria-hidden size={18} className="text-white" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[hsl(18_95%_62%)] mb-0.5">1v1 Battles</p>
          <p className="text-[12px] font-bold leading-tight">Challenge a friend — winner takes the score</p>
        </div>
        <ChevronRight aria-hidden size={16} className="text-muted-foreground shrink-0" />
      </button>

      {/* Season banner */}
      <div className="animate-reveal animate-reveal-delay-1 relative overflow-hidden rounded-2xl border border-gold/40 glass-3d p-4 mb-4 glow-gold-sm">
        <div
          /* !absolute: .glass-3d > * forces children position:relative, which
             pulled this decorative glow into flow and left a 128px void above
             the content. !absolute keeps it out of flow as intended. */
          className="!absolute -top-12 -right-8 h-32 w-32 rounded-full opacity-30 blur-2xl pointer-events-none"
          style={{ background: "hsl(var(--gold))" }}
          aria-hidden
        />
        <div className="flex items-center justify-between gap-2 relative">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-gold/80 font-bold">Current Season</p>
            <p className="font-display font-bold text-lg tracking-tight mt-0.5">{activeSeason?.name || "Season"}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-bold">Ends in</p>
            <p className="font-display font-black text-sm text-gold flex items-center justify-end gap-1 tabular-nums mt-0.5">
              <Clock3 aria-hidden size={14} /> <CountdownTimer endsAt={activeSeason?.ends_at} />
            </p>
          </div>
        </div>
        <p className="text-[12px] text-muted-foreground mt-3 relative flex items-center gap-1.5">
          <Crown aria-hidden size={12} className="text-gold shrink-0" />
          #1 earns <span className="text-gold font-semibold">Season Champion</span> reward + permanent profile badge.
        </p>
      </div>

      {/* Mode switcher — paged tabs with swipe hint */}
      <ModeTabs mode={mode} onChange={setMode} />


      {profile && (
        <div className="animate-reveal animate-reveal-delay-2 relative overflow-hidden rounded-2xl border border-gold/40 glass-3d p-4 mb-5 glow-gold-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-gold text-primary-foreground font-display font-black text-base shadow-lg shadow-gold/30">
                  {hasRank ? <span className="tabular-nums">#<AnimatedNumber value={rank ?? 0} duration={800} /></span> : "—"}
              </div>
              <div>
                <p className="font-display font-bold text-base tracking-tight">Your Position</p>
                <p className="text-xs text-muted-foreground">
                  {hasRank ? (
                    <>Ahead of <span className="text-gold font-bold">{Math.min(99, Math.round(percentile))}%</span> · {mode === "season" ? "Season" : "All Time"}</>
                  ) : (
                    <>Make your first check-in · {mode === "season" ? "Season" : "All Time"}</>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Season wins: <span className="text-gold font-bold">{mySeasonWins}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge tier={profile.status_tier || 'recruit'} division={(profile as any).tier_division ?? 0} size="sm" showAura={false} />
              <TrendingUp aria-hidden size={16} className="text-gold" />
            </div>
          </div>
          {hasRank && percentile < 50 && (
            <p className="text-[11px] text-destructive font-bold mt-3 text-center uppercase tracking-wider inline-flex items-center gap-1 w-full justify-center"><AlertTriangle size={11} aria-hidden /> Falling behind — others are gaining</p>
          )}
          {hasRank && percentile >= 90 && (
            <p className="text-[11px] text-gold font-bold mt-3 text-center uppercase tracking-wider inline-flex items-center gap-1 w-full justify-center"><Flame size={11} aria-hidden /> Top {Math.max(1, Math.round(100 - percentile))}% — defend your spot</p>
          )}
        </div>
      )}

      {/* Data-phase skeleton — RouteFallback only covers the lazy-chunk load;
          without this the podium+rows popped in with a big layout shift. */}
      {(mode === "season" ? seasonLoading : allTimeLoading) && currentLeaders.length === 0 && (
        <BoardRowsSkeleton />
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

      {/* "The Chase" = ranks 4+. Only render its divider when there ARE rows
          below the podium, so a sparse/first-run board never shows an orphan
          header. A truly empty board gets a proper empty state instead. */}
      {currentLeaders.length > 3 && (
      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-bold">The Chase</p>
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
                style={
                  // Skip paint/layout for off-screen rows beyond the first
                  // screenful — cheap virtualization, no container rewrite.
                  i < 8 ? undefined : { contentVisibility: "auto", containIntrinsicSize: "auto 68px" }
                }
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
                <StatusAvatar src={user.avatar_url} name={user.username} tier={user.status_tier || 'recruit'} size="sm" animated={false} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                    <TierUsername username={user.username} tier={user.status_tier || "recruit"} />
                    {verifiedSet?.has(user.user_id) && (
                      <span
                        className="shrink-0 inline-flex items-center justify-center h-[15px] w-[15px] rounded-md bg-teal/15 border border-teal/30 text-teal"
                        aria-label="HealthKit-verified — unfakeable discipline"
                        title="Verified by Apple Health"
                      >
                        <ShieldCheck aria-hidden size={12} strokeWidth={2.6} />
                      </span>
                    )}
                    {isMe && <span className="text-[10px] text-gold/70 font-medium">(you)</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[12px] text-muted-foreground">Lv {user.level}</p>
                    {user.streak > 0 && (
                      <>
                        <span className="text-muted-foreground/75">•</span>
                        <StreakFlameInline streak={user.streak} suffix="d" className="text-[11px]" />
                      </>
                    )}
                    {wins > 0 && (
                      <p className="text-[11px] text-gold/80 flex items-center gap-0.5">
                        <Medal aria-hidden size={11} /> {wins}×
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-display font-black text-sm tabular-nums", isMe && "text-gold")}>
                    {points.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground/75 uppercase tracking-wider font-bold">
                    {mode === "season" ? "Season XP" : "XP"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Nobody on the board yet (fresh deploy / new season) — invite action.
          Gated on the ACTIVE mode's loading state so a cold cache doesn't flash
          "the board is warming up" for ~500ms before data lands. */}
      {currentLeaders.length === 0 && !(mode === "season" ? seasonLoading || !activeSeason : allTimeLoading) && (
        <div className="mt-4 animate-reveal animate-reveal-delay-3">
          <EmptyState
            icon={Trophy}
            title="The board is warming up"
            description="Be the first to check in and claim rank #1."
            action={<Button size="sm" onClick={() => navigate("/checkin")}>Check in now</Button>}
          />
        </div>
      )}

      {/* Secondary boards — different purposes (tribes, invites) collapsed so
          Ranks stays focused on the one question: where do I rank? */}
      <MoreSection label="More boards" className="mt-4">
        <TopTribesWidget />
        <TopInvitersWidget />
      </MoreSection>

      {championData?.recent?.length ? (
        <div className="mt-6 rounded-xl border border-border glass-3d p-4 animate-reveal animate-reveal-delay-3">
          <div className="flex items-center gap-2 mb-3">
            <Trophy aria-hidden size={16} className="text-gold" />
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
            <Crown aria-hidden size={28} className="text-gold drop-shadow-[0_0_12px_hsl(var(--gold)/0.9)] animate-[float_3s_ease-in-out_infinite]" />
            <div className="absolute inset-0 blur-md opacity-70 animate-pulse">
              <Crown aria-hidden size={28} className="text-gold" />
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

      <div className={cn("absolute top-2 right-2 font-display font-black text-[11px] tabular-nums uppercase tracking-wider",
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
          <StatusAvatar aria-hidden
            src={user.avatar_url}
            name={user.username}
            tier={user.status_tier || "recruit"}
            size={isFirst ? "md" : "sm"}
          />
        </div>
      </div>

      <TierUsername
        as="p"
        username={user.username}
        tier={user.status_tier || "recruit"}
        className="font-display font-bold text-xs mt-2 truncate max-w-full px-1"
      />
      {isMe && <span className="text-[10px] text-gold/70 font-medium -mt-0.5">(you)</span>}
      <p className={cn(
        "font-display font-black tabular-nums mt-1",
        isFirst ? "text-gold text-xl" : "text-foreground text-sm",
      )}>
        {points.toLocaleString()}
      </p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
        {mode === "season" ? "Season XP" : "XP"}
      </p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap justify-center">
        {user.streak > 0 && (
          <StreakFlameInline streak={user.streak} suffix="d" className={cn(isFirst ? "text-[12px]" : "text-[11px]")} />
        )}
        {wins > 0 && (
          <p className="text-[10px] text-gold/80 flex items-center gap-0.5">
            <Medal aria-hidden size={11} /> {wins}×
          </p>
        )}
      </div>
    </button>
  );
};

interface ModeTabsProps {
  mode: "season" | "all_time";
  onChange: (m: "season" | "all_time") => void;
}

const ModeTabs = ({ mode, onChange }: ModeTabsProps) => {
  const isSeason = mode === "season";
  return (
    <div className="animate-reveal animate-reveal-delay-1 mb-4">
      <div
        className="relative grid grid-cols-2 rounded-full border border-gold/30 bg-card/70 backdrop-blur-md p-1 shadow-[0_8px_24px_-12px_hsl(var(--gold)/0.35)]"
        role="tablist"
        aria-label="Leaderboard mode"
      >
        {/* Sliding indicator */}
        <div
          aria-hidden
          className={cn(
            "absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1.2,0.32,1)]",
            "bg-gradient-to-br from-gold/95 via-gold to-gold/85",
            "shadow-[0_4px_16px_-4px_hsl(var(--gold)/0.65),inset_0_1px_0_hsl(var(--gold-light)/0.7)]",
          )}
          style={{ transform: isSeason ? "translateX(0%)" : "translateX(100%)" }}
        />
        <button
          role="tab"
          aria-selected={isSeason}
          onClick={() => onChange("season")}
          className={cn(
            "relative z-10 py-2 min-h-11 text-xs font-display font-black uppercase tracking-[0.22em] transition-colors active:scale-[0.97]",
            isSeason ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Clock3 aria-hidden size={12} className={cn(isSeason ? "text-primary-foreground" : "text-gold/80")} />
            Season
          </span>
        </button>
        <button
          role="tab"
          aria-selected={!isSeason}
          onClick={() => onChange("all_time")}
          className={cn(
            "relative z-10 py-2 min-h-11 text-xs font-display font-black uppercase tracking-[0.22em] transition-colors active:scale-[0.97]",
            !isSeason ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="inline-flex items-center gap-1.5">
            <Trophy aria-hidden size={12} className={cn(!isSeason ? "text-primary-foreground" : "text-gold/80")} />
            All Time
          </span>
        </button>
      </div>
      {/* Swipe hint */}
      <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-bold">
        <ChevronLeft aria-hidden size={12} className={cn("transition-opacity", isSeason ? "opacity-20" : "opacity-70 text-gold/70")} />
        <span>Swipe to switch</span>
        <ChevronRight aria-hidden size={12} className={cn("transition-opacity", !isSeason ? "opacity-20" : "opacity-70 text-gold/70")} />
      </div>
    </div>
  );
};

export default Leaderboard;
