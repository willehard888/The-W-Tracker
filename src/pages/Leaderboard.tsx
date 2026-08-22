import { Trophy, Crown, Clock3, Medal, Swords, ShieldCheck, ChevronLeft, ChevronRight, Info } from "lucide-react";
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
import TopInvitersWidget from "@/components/TopInvitersWidget";
import TopTribesWidget from "@/components/TopTribesWidget";
import MoreSection from "@/components/ui/more-section";
import { Button } from "@/components/ui/button";
import { BoardRowsSkeleton } from "@/components/skeletons/PageSkeleton";
import StreakFlameInline from "@/components/StreakFlameInline";
import { useMyRank } from "@/hooks/use-my-rank";
import { useStandings } from "@/hooks/use-standings";
import { hapticSelection } from "@/lib/haptics";
import EmptyState from "@/components/ui/empty-state";
import StandingCard from "@/components/status/StandingCard";
import { useStatusExplainer } from "@/components/status/StatusExplainerProvider";

/**
 * Ranks — one question, answered two ways:
 *   Standings  = the ladder. Ordered by Consistency (0–100), the same number
 *                that produces "#N of M · Top X%" everywhere else in the app.
 *                Rows come from get_standings, the SAME ORDER BY as
 *                get_user_rank — so your row number here ≡ your #N on Profile.
 *   Season     = the sprint. XP earned since the season started; #1 becomes
 *                Season Champion.
 * (The old "All time XP" board ranked by lifetime XP while the user's own #N
 * came from rank_score — two orderings on one screen. Gone.)
 */

type Mode = "standings" | "season";

/** One row shape for both boards — `value` is Consistency or season XP. */
type BoardRow = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  status_tier: string | null;
  streak: number;
  value: number;
};

type SeasonProfile = {
  username: string;
  xp: number;
  streak: number;
  user_id: string;
  avatar_url: string | null;
  status_tier: string | null;
};

const BOARD_LIMIT = 50;
const VALUE_LABEL: Record<Mode, string> = { standings: "Consistency", season: "XP this season" };

const formatCountdown = (endsAt?: string) => {
  if (!endsAt) return "--";
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Season ended";
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${hours}h ${minutes}m`;
};

/** Isolated countdown — only this span re-renders every minute. */
const CountdownTimer = ({ endsAt }: { endsAt?: string }) => {
  const [text, setText] = useState(() => formatCountdown(endsAt));
  useEffect(() => {
    setText(formatCountdown(endsAt));
    const id = setInterval(() => setText(formatCountdown(endsAt)), 60_000);
    return () => clearInterval(id);
  }, [endsAt]);
  return <span>{text}</span>;
};

const Leaderboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const explainer = useStatusExplainer();
  const [mode, setMode] = useState<Mode>("standings");
  const { scrollRef, pullDistance, isRefreshing, onTouchStart: pullStart, onTouchMove: pullMove, onTouchEnd: pullEnd, PULL_THRESHOLD } = usePullRefresh([
    ["standings"],
    ["leaderboard-season"],
    ["active-season"],
    ["leaderboard-champions"],
    ["my-rank"],
  ]);

  // Pull-to-refresh + horizontal swipe between Standings/Season. Detection
  // runs during touchMOVE — on iOS a swipe with vertical drift ends as
  // `touchcancel`, so an end-delta check would silently never run.
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
      setMode(dx < 0 ? "season" : "standings"); // left → Season, right → Standings
      hapticSelection();
    }
  };
  const onTouchEnd = () => {
    pullEnd();
    swipe.current = null;
  };

  // ── Standings (Consistency order — identical to get_user_rank) ──
  const { data: standings, isLoading: standingsLoading } = useStandings(BOARD_LIMIT);
  const { data: myRankData } = useMyRank(profile?.user_id);

  // ── Season ──
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
          .select("username, xp, streak, user_id, avatar_url, status_tier")
          .gt("xp", 0),
      ]);
      const baselineMap = new Map<string, number>((baselines || []).map((b: any) => [b.user_id, b.baseline_xp]));
      const full = ((profiles || []) as SeasonProfile[])
        .map((p) => ({ ...p, season_points: Math.max(p.xp - (baselineMap.get(p.user_id) ?? p.xp), 0) }))
        .sort((a, b) => b.season_points - a.season_points || b.xp - a.xp);
      const myIdx = profile?.user_id ? full.findIndex((u) => u.user_id === profile.user_id) : -1;
      return {
        total: full.length,
        top: full.slice(0, BOARD_LIMIT).map<BoardRow>((p) => ({
          user_id: p.user_id, username: p.username, avatar_url: p.avatar_url,
          status_tier: p.status_tier, streak: p.streak, value: p.season_points,
        })),
        myRank: myIdx >= 0 ? myIdx + 1 : null,
        myPoints: myIdx >= 0 ? full[myIdx].season_points : 0,
      };
    },
  });

  const { data: championData } = useQuery({
    queryKey: ["leaderboard-champions"],
    staleTime: 30 * 60_000,
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
      for (const row of champions || []) counts[row.user_id] = (counts[row.user_id] || 0) + 1;
      const recent = (champions || []).slice(0, 6).map((c: any) => ({ ...c, season_name: seasonNames.get(c.season_id) || "Season" }));
      return { counts, recent };
    },
  });

  const standingRows = useMemo<BoardRow[]>(() => (standings ?? []).map((r) => ({
    user_id: r.user_id, username: r.username, avatar_url: r.avatar_url,
    status_tier: r.status_tier, streak: r.streak, value: Math.round(Number(r.rank_score) || 0),
  })), [standings]);

  const currentLeaders = mode === "standings" ? standingRows : seasonData?.top ?? [];
  const loading = mode === "standings" ? standingsLoading : seasonLoading || !activeSeason;

  // HealthKit-verified leaders — same `verified_authors` RPC the feed uses.
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

  const mySeasonWins = profile?.user_id ? championData?.counts?.[profile.user_id] || 0 : 0;
  const tier = profile?.status_tier || "recruit";

  return (
    <div
      ref={scrollRef}
      className="min-h-full pb-4 px-4 pt-6"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} threshold={PULL_THRESHOLD} />

      {/* Header — title matches the tab ("Ranks"); one line says what the
          order IS, and the (i) opens the explainer with live numbers. */}
      <div className="animate-reveal mb-4 relative">
        <div className="absolute -inset-x-8 -top-6 -bottom-6 pointer-events-none -z-10"
             style={{ background: "radial-gradient(ellipse 90% 70% at 50% 0%, hsl(var(--gold) / 0.22) 0%, transparent 65%)" }}
             aria-hidden
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <Trophy size={24} className="text-gold drop-shadow-[0_0_12px_hsl(var(--gold)/0.6)] shrink-0" />
              <h1 className="font-display text-2xl font-black tracking-tight bg-gradient-to-br from-gold via-gold-light to-gold bg-clip-text text-transparent">
                Ranks
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1.5">
              {mode === "standings"
                ? "Ordered by Consistency — the ladder only counts showing up."
                : "XP earned this season — #1 becomes Season Champion."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { hapticSelection(); explainer?.open(); }}
            className="shrink-0 mt-0.5 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-[11px] font-bold text-muted-foreground active:scale-95 transition hover:text-foreground"
          >
            <Info size={12} /> How it works
          </button>
        </div>
      </div>

      <ModeTabs mode={mode} onChange={setMode} />

      {/* Hero — YOUR place, in the board's own currency */}
      {profile && mode === "standings" && (
        <div className="animate-reveal animate-reveal-delay-2 mb-5">
          <StandingCard
            tier={tier}
            rankData={myRankData}
            consistency={Number((profile as any).rank_score) || null}
            onHowItWorks={() => explainer?.open()}
            onOpenLadder={() => explainer?.open()}
          />
        </div>
      )}
      {profile && mode === "season" && (
        <SeasonHero
          seasonName={activeSeason?.name}
          endsAt={activeSeason?.ends_at}
          rank={seasonData?.myRank ?? null}
          points={seasonData?.myPoints ?? 0}
          wins={mySeasonWins}
        />
      )}

      {/* Data-phase skeleton — RouteFallback only covers the lazy-chunk load. */}
      {loading && currentLeaders.length === 0 && <BoardRowsSkeleton />}

      {/* Podium — top 3 */}
      {currentLeaders.length >= 1 && (
        <div className="relative mb-5 animate-reveal animate-reveal-delay-2">
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 w-56 h-56 pointer-events-none -z-10 opacity-70"
            style={{ background: "radial-gradient(circle at 50% 30%, hsl(var(--gold) / 0.35) 0%, transparent 60%)", filter: "blur(12px)" }}
            aria-hidden
          />
          <div className="grid grid-cols-3 gap-2 items-end">
            {([1, 0, 2] as const).map((idx) => {
              const u = currentLeaders[idx];
              if (!u) return <div key={idx} />;
              return (
                <PodiumCard
                  key={u.user_id}
                  user={u}
                  rank={(idx + 1) as 1 | 2 | 3}
                  valueLabel={VALUE_LABEL[mode]}
                  isMe={u.user_id === profile?.user_id}
                  wins={championData?.counts?.[u.user_id] || 0}
                  onClick={() => navigate(`/user/${u.user_id}`)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Ranks 4+ */}
      {currentLeaders.length > 3 && (
        <div className="mt-4 animate-reveal animate-reveal-delay-3">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <p className="eyebrow">The Chase</p>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
          <div className="space-y-1.5">
            {currentLeaders.slice(3).map((user, i) => {
              const wins = championData?.counts?.[user.user_id] || 0;
              const displayRank = i + 4;
              const isMe = user.user_id === profile?.user_id;
              const isTop10 = displayRank <= 10;
              return (
                <button
                  key={user.user_id}
                  onClick={() => navigate(`/user/${user.user_id}`)}
                  style={i < 8 ? undefined : { contentVisibility: "auto", containIntrinsicSize: "auto 68px" }}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.99]",
                    isMe
                      ? "border-gold/50 bg-gradient-to-r from-gold/10 via-gold/5 to-transparent ring-1 ring-gold/40 shadow-[0_0_20px_hsl(var(--gold)/0.15)]"
                      : isTop10
                      ? "border-border bg-card hover:border-gold/20"
                      : "border-border/60 bg-card/60",
                  )}
                >
                  <div className={cn(
                    "shrink-0 h-9 w-9 rounded-lg flex items-center justify-center font-display font-black text-sm tabular-nums",
                    isTop10 ? "bg-gold/10 text-gold border border-gold/20" : "bg-secondary text-muted-foreground",
                  )}>
                    {displayRank}
                  </div>
                  <StatusAvatar src={user.avatar_url} name={user.username} tier={user.status_tier || "recruit"} size="sm" animated={false} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                      <TierUsername username={user.username} tier={user.status_tier || "recruit"} />
                      {verifiedSet?.has(user.user_id) && (
                        <span
                          className="shrink-0 inline-flex items-center justify-center h-[15px] w-[15px] rounded-md bg-teal/15 border border-teal/30 text-teal"
                          aria-label="HealthKit-verified"
                          title="Verified by Apple Health"
                        >
                          <ShieldCheck size={10} strokeWidth={2.6} />
                        </span>
                      )}
                      {isMe && <span className="text-[10px] text-gold/70 font-medium">(you)</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 min-h-[14px]">
                      {user.streak > 0 && <StreakFlameInline streak={user.streak} suffix="d" className="text-[10px]" />}
                      {wins > 0 && (
                        <p className="text-[10px] text-gold/80 flex items-center gap-0.5">
                          <Medal size={9} /> {wins}×
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-display font-black text-sm tabular-nums", isMe && "text-gold")}>
                      {user.value.toLocaleString()}
                    </p>
                    <p className="eyebrow">{VALUE_LABEL[mode]}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty board (fresh deploy / new season) */}
      {currentLeaders.length === 0 && !loading && (
        <div className="mt-4 animate-reveal animate-reveal-delay-3">
          <EmptyState
            icon={Trophy}
            title="The board is warming up"
            description="Be the first to check in and claim rank #1."
            action={<Button size="sm" onClick={() => navigate("/checkin")}>Check in now</Button>}
          />
        </div>
      )}

      {/* Other boards — different questions, tucked away so Ranks stays
          about the one: where do I stand? */}
      <MoreSection label="More boards" className="mt-4">
        <button
          onClick={() => navigate("/battles")}
          className="w-full text-left surface-card p-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[hsl(22_90%_52%)] to-[hsl(12_88%_46%)] flex items-center justify-center shrink-0">
            <Swords size={18} className="text-white" strokeWidth={2.4} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="eyebrow text-[hsl(18_95%_62%)] mb-0.5">1v1 Battles</p>
            <p className="text-[12px] font-bold leading-tight">Challenge a friend — winner takes the score</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground shrink-0" />
        </button>
        <TopTribesWidget />
        <TopInvitersWidget />
      </MoreSection>

      {mode === "season" && championData?.recent?.length ? (
        <div className="mt-6 surface-card p-4 animate-reveal animate-reveal-delay-3">
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

/** Season hero — your sprint position, the season clock, and the prize. */
const SeasonHero = ({ seasonName, endsAt, rank, points, wins }: {
  seasonName?: string; endsAt?: string; rank: number | null; points: number; wins: number;
}) => (
  <div className="animate-reveal animate-reveal-delay-2 relative overflow-hidden surface-card p-4 mb-5">
    <div className="absolute -top-12 -right-8 h-32 w-32 rounded-full opacity-25 blur-2xl pointer-events-none" style={{ background: "hsl(var(--gold))" }} aria-hidden />
    <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="eyebrow">{seasonName || "Season"}</p>
        <p className="font-display font-black text-2xl tracking-tight mt-1 tabular-nums">
          {rank ? `Season #${rank.toLocaleString()}` : "Not on the board yet"}
        </p>
        <p className="text-xs text-muted-foreground mt-1 tabular-nums">
          {rank ? <><span className="text-gold font-bold">{points.toLocaleString()} XP</span> this season</> : "Your first check-in puts you on the board."}
          {wins > 0 && <> · <Medal size={10} className="inline text-gold -mt-0.5" /> {wins}× champion</>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="eyebrow">Ends in</p>
        <p className="font-display font-black text-sm text-gold flex items-center justify-end gap-1 tabular-nums mt-1">
          <Clock3 size={13} /> <CountdownTimer endsAt={endsAt} />
        </p>
      </div>
    </div>
    <p className="relative text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
      <Crown size={12} className="text-gold shrink-0" />
      #1 earns <span className="text-gold font-semibold">Season Champion</span> — a permanent profile badge.
    </p>
  </div>
);

interface PodiumCardProps {
  user: BoardRow;
  rank: 1 | 2 | 3;
  valueLabel: string;
  isMe: boolean;
  wins: number;
  onClick: () => void;
}

const PodiumCard = ({ user, rank, valueLabel, isMe, wins, onClick }: PodiumCardProps) => {
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
        heightClass, accent, isMe && "ring-2 ring-gold/60",
      )}
    >
      {isFirst && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="relative">
            <Crown size={28} className="text-gold drop-shadow-[0_0_12px_hsl(var(--gold)/0.9)] animate-[float_3s_ease-in-out_infinite]" />
            <div className="absolute inset-0 blur-md opacity-70 animate-pulse"><Crown size={28} className="text-gold" /></div>
          </div>
        </div>
      )}
      {isFirst && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-60"
          aria-hidden
          style={{ background: "linear-gradient(135deg, hsl(var(--gold) / 0.15) 0%, transparent 45%, transparent 55%, hsl(var(--gold) / 0.1) 100%)" }}
        />
      )}
      <div className={cn("absolute top-2 right-2 font-display font-black text-[10px] tabular-nums uppercase tracking-wider",
        isFirst ? "text-gold" : isSecond ? "text-foreground/60" : "text-amber-600")}>
        {rankLabel}
      </div>
      <div className={cn("relative", isFirst && "scale-110")}>
        {isFirst && <div className="absolute inset-0 rounded-full blur-xl opacity-60 animate-pulse" style={{ background: "hsl(var(--gold) / 0.6)" }} aria-hidden />}
        <div className="relative">
          <StatusAvatar src={user.avatar_url} name={user.username} tier={user.status_tier || "recruit"} size={isFirst ? "md" : "sm"} />
        </div>
      </div>
      <TierUsername as="p" username={user.username} tier={user.status_tier || "recruit"} className="font-display font-bold text-xs mt-2 truncate max-w-full px-1" />
      {isMe && <span className="text-[10px] text-gold/70 font-medium -mt-0.5">(you)</span>}
      <p className={cn("font-display font-black tabular-nums mt-1", isFirst ? "text-gold text-xl" : "text-foreground text-sm")}>
        {user.value.toLocaleString()}
      </p>
      <p className="eyebrow">{valueLabel}</p>
      <div className="flex items-center gap-2 mt-1.5 flex-wrap justify-center">
        {user.streak > 0 && <StreakFlameInline streak={user.streak} suffix="d" className={cn(isFirst ? "text-[11px]" : "text-[10px]")} />}
        {wins > 0 && <p className="text-[10px] text-gold/80 flex items-center gap-0.5"><Medal size={9} /> {wins}×</p>}
      </div>
    </button>
  );
};

const ModeTabs = ({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) => {
  const isStandings = mode === "standings";
  const pick = (m: Mode) => { if (m !== mode) { hapticSelection(); onChange(m); } };
  return (
    <div className="animate-reveal animate-reveal-delay-1 mb-4">
      <div
        className="relative grid grid-cols-2 rounded-full border border-gold/30 bg-card/70 backdrop-blur-md p-1 shadow-[0_8px_24px_-12px_hsl(var(--gold)/0.35)]"
        role="tablist"
        aria-label="Ranks mode"
      >
        <div
          aria-hidden
          className={cn(
            "absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] rounded-full transition-transform duration-500 ease-[cubic-bezier(0.16,1.2,0.32,1)]",
            "bg-gradient-to-br from-gold/95 via-gold to-gold/85",
            "shadow-[0_4px_16px_-4px_hsl(var(--gold)/0.65),inset_0_1px_0_hsl(var(--gold-light)/0.7)]",
          )}
          style={{ transform: isStandings ? "translateX(0%)" : "translateX(100%)" }}
        />
        <button
          role="tab"
          aria-selected={isStandings}
          onClick={() => pick("standings")}
          className={cn("relative z-10 py-2 text-xs font-display font-black uppercase tracking-[0.22em] transition-colors",
            isStandings ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <span className="inline-flex items-center gap-1.5">
            <Trophy size={12} className={cn(isStandings ? "text-primary-foreground" : "text-gold/80")} />
            Standings
          </span>
        </button>
        <button
          role="tab"
          aria-selected={!isStandings}
          onClick={() => pick("season")}
          className={cn("relative z-10 py-2 text-xs font-display font-black uppercase tracking-[0.22em] transition-colors",
            !isStandings ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          <span className="inline-flex items-center gap-1.5">
            <Clock3 size={12} className={cn(!isStandings ? "text-primary-foreground" : "text-gold/80")} />
            Season
          </span>
        </button>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70 font-bold">
        <ChevronLeft size={10} className={cn("transition-opacity", isStandings ? "opacity-20" : "opacity-70 text-gold/70")} />
        <span>Swipe to switch</span>
        <ChevronRight size={10} className={cn("transition-opacity", !isStandings ? "opacity-20" : "opacity-70 text-gold/70")} />
      </div>
    </div>
  );
};

export default Leaderboard;
