import { fmtInt, fmtUnit } from "@/lib/format";
import { Trophy, Crown, Medal, Swords, ShieldCheck } from "lucide-react";
import StatusAvatar from "@/components/StatusAvatar";
import TierUsername from "@/components/TierUsername";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchAllTimeLeaders, fetchActiveSeason, fetchSeasonBoard, type LeaderRow } from "@/lib/leaderboard-query";
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
import { Block } from "@/components/skeletons/PageSkeleton";
import { SettingsRow } from "@/components/settings/SettingsList";
import StreakFlameInline from "@/components/StreakFlameInline";
import { useMyRank } from "@/hooks/use-my-rank";
import { hapticSelection } from "@/lib/haptics";
import EmptyState from "@/components/ui/empty-state";
import { SEGMENT_TRACK, SEGMENT_ACTIVE, SEGMENT_IDLE } from "@/components/ui/segment";
import { useOnboardingTrigger, useSpotlightTarget } from "@/components/onboarding/onboarding-context";

type Mode = "season" | "all_time";

const formatCountdown = (endsAt?: string) => {
  if (!endsAt) return "";
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "Season ended";

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Seconds only inside the final hour — a 23-day countdown ticking every
  // second at the top of the page is motion with no information in it.
  if (days > 0) return `${days}d ${hours}h ${minutes}m left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m ${seconds}s left`;
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
    // Tick per minute until the last hour; per second only when seconds show.
    const finalHour = endsAt ? new Date(endsAt).getTime() - Date.now() < 3_600_000 : false;
    const id = setInterval(() => setText(formatCountdown(endsAt)), finalHour ? 1000 : 60_000);
    return () => clearInterval(id);
  }, [endsAt]);
  return <span>{text}</span>;
};

/** Data-phase skeletons in the screen's own silhouette — the beat sits above
 *  the segment, the podium and five rows below it. RouteFallback only covers
 *  the lazy-chunk load; without these the board popped in with a layout shift. */
const BeatSkeleton = () => (
  <div>
    <Block height={28} className="w-3/4 !rounded-lg" />
    <Block height={28} delay={40} className="w-1/2 mt-1.5 !rounded-lg" />
    <Block height={12} delay={80} className="w-28 mt-3 !rounded-md" />
  </div>
);

const BoardSkeleton = () => (
  <div>
    <div className="grid grid-cols-3 gap-2 items-end">
      <Block height={150} className="!rounded-2xl" />
      <Block height={176} delay={40} className="!rounded-2xl" />
      <Block height={134} delay={80} className="!rounded-2xl" />
    </div>
    <div className="mt-4 divide-y divide-border/35">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="py-3">
          <Block height={36} delay={120 + i * 40} />
        </div>
      ))}
    </div>
  </div>
);

const Leaderboard = () => {
  // Contextual onboarding: first /leaderboard visit → Season vs All-Time.
  const ranksTargetRef = useSpotlightTarget("RANKS_INTRO");
  useOnboardingTrigger("RANKS_INTRO", true);
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("season");
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
  const onTouchEnd = () => {
    pullEnd();
    swipe.current = null;
  };

  const { data: allTimeLeaders, isLoading: allTimeLoading } = useQuery({
    queryKey: ["leaderboard-all-time"],
    staleTime: 5 * 60_000,   // leaderboard refreshes every 5 min is more than enough
    gcTime:    15 * 60_000,
    queryFn: fetchAllTimeLeaders,
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

  const { data: activeSeason, isLoading: seasonMetaLoading } = useQuery({
    queryKey: ["active-season"],
    staleTime: 10 * 60_000,
    gcTime:    30 * 60_000,
    queryFn: fetchActiveSeason,
  });

  const { data: seasonData, isLoading: seasonLoading } = useQuery({
    queryKey: ["leaderboard-season", activeSeason?.id, profile?.user_id],
    enabled: !!activeSeason?.id,
    staleTime: 5 * 60_000,
    gcTime:    15 * 60_000,
    queryFn: () => fetchSeasonBoard(activeSeason.id),
  });

  const { data: championData } = useQuery({
    queryKey: ["leaderboard-champions"],
    staleTime: 30 * 60_000,  // champion history doesn't change mid-session
    gcTime:    60 * 60_000,
    queryFn: async () => {
      const [{ data: champions }, { data: seasons }] = await Promise.all([
        supabase
          .from("leaderboard_champions")
          .select("user_id, username_snapshot, season_points, season_id, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("leaderboard_seasons").select("id, name"),
      ]);

      const seasonNames = new Map<string, string>((seasons || []).map((s) => [s.id, s.name]));
      const counts: Record<string, number> = {};
      for (const row of champions || []) {
        counts[row.user_id] = (counts[row.user_id] || 0) + 1;
      }

      const recent = (champions || []).slice(0, 6).map((c) => ({
        ...c,
        season_name: seasonNames.get(c.season_id) || "Season",
      }));

      return { counts, recent };
    },
  });

  const currentLeaders = mode === "season" ? seasonData?.top || [] : allTimeLeaders || [];
  const boardTotal = mode === "season" ? seasonData?.total || 0 : totalCount || 0;
  // All-Time position derives from the SAME XP-ordered list the board shows —
  // the rank_score-based RPC could say "#7" while the user's own highlighted
  // row sat at #12 on the very same screen. RPC stays as the fallback for
  // users deeper than the visible board.
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
  const hasRank = mode === "season" ? Boolean(rank) : (myAllTimeIdx >= 0 || Boolean(myRankData?.hasRank));

  // The beat can only say something true once the whole mode has landed —
  // a half-loaded all-time board would read "#4 of 0".
  const boardLoading = mode === "season"
    ? seasonMetaLoading || seasonLoading
    : allTimeLoading || totalCount === undefined;

  // Who is just above you: the lead of the person one place up, when both of
  // you are on the visible board. Off the board, the beat states rank alone.
  const points = (u: LeaderRow) => (mode === "season" ? u.season_points || 0 : u.xp);
  const me = rank ? currentLeaders[rank - 1] : undefined;
  const above = rank && rank > 1 ? currentLeaders[rank - 2] : undefined;
  const gap = me && above && me.user_id === profile?.user_id ? points(above) - points(me) : null;

  // Access is gated globally by AccessGate (8,99 €/mo membership or 14-day trial).
  return (
    <div
      ref={scrollRef}
      className="min-h-full px-4 pt-4 pb-6"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <PullRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} threshold={PULL_THRESHOLD} />

      {/* ── OPENING BEAT — where you stand, stated once. Type on the page,
             not a card: the old title, season banner and "Your Position"
             card fold into this one line and the quiet status under it. ── */}
      <header className="home-rise mb-5">
        {boardLoading ? (
          <BeatSkeleton />
        ) : (
          <>
            <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">
              {hasRank && rank ? (
                <>
                  <span className="text-gold tabular-nums">#{fmtInt(rank)}</span> of {fmtInt(boardTotal)}.
                  {rank === 1
                    ? " Nobody above you."
                    : gap != null && gap > 0
                    ? ` ${fmtUnit(gap, "XP")} above you.`
                    : null}
                </>
              ) : (
                "Your first check-in puts you on the board."
              )}
            </h1>
            <p className="eyebrow mt-2">
              {mode === "season" ? (
                <>
                  {activeSeason?.name || "Season"}
                  {activeSeason?.ends_at && <> · <CountdownTimer endsAt={activeSeason.ends_at} /></>}
                </>
              ) : (
                "All time · lifetime XP"
              )}
            </p>
          </>
        )}
      </header>

      {/* ── SEGMENT — season or all time. Carries the RANKS_INTRO spotlight;
             the horizontal swipe on the page switches it too. ── */}
      <div ref={ranksTargetRef} className="home-rise home-rise-1 mb-5">
        <div className={SEGMENT_TRACK} role="tablist" aria-label="Board">
          {(["season", "all_time"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => { void hapticSelection(); setMode(m); }}
              className={cn("eyebrow flex-1 min-h-11 rounded-lg transition-colors", mode === m ? SEGMENT_ACTIVE : SEGMENT_IDLE)}
            >
              {m === "season" ? "Season" : "All time"}
            </button>
          ))}
        </div>
      </div>

      {boardLoading && currentLeaders.length === 0 && <BoardSkeleton />}

      {/* ── HERO — the podium. One spotlight, behind #1; the other two sit
             on quiet surfaces so the leader is the screen's spectacle. ── */}
      {!boardLoading && currentLeaders.length > 0 && (
        <div className="home-rise home-rise-2 relative isolate">
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 top-0 w-56 h-56 pointer-events-none -z-10 opacity-70"
            style={{
              background: "radial-gradient(circle at 50% 30%, hsl(var(--gold) / 0.35) 0%, transparent 60%)",
              filter: "blur(12px)",
            }}
          />
          <div className="grid grid-cols-3 gap-2 items-end">
            {([1, 0, 2] as const).map((i) => {
              const u = currentLeaders[i];
              return u ? (
                <PodiumCard
                  key={u.user_id}
                  user={u}
                  rank={(i + 1) as 1 | 2 | 3}
                  points={points(u)}
                  isMe={u.user_id === profile?.user_id}
                  wins={championData?.counts?.[u.user_id] || 0}
                  onClick={() => navigate(`/user/${u.user_id}`)}
                />
              ) : (
                <div key={i} aria-hidden />
              );
            })}
          </div>
        </div>
      )}

      {/* ── THE CHASE — ranks 4+ as hairline rows. Only the first screenful
             animates; the rest are content-visibility:auto and skip paint.
             Flames are `still` here (one per row behind a .limit(50)) and
             animated on the podium alone. ── */}
      {!boardLoading && currentLeaders.length > 3 && (
        <ul className="mt-2 divide-y divide-border/35">
          {currentLeaders.slice(3).map((user, i) => {
            const isMe = user.user_id === profile?.user_id;
            const wins = championData?.counts?.[user.user_id] || 0;
            return (
              <li
                key={user.user_id}
                className={cn(i < 8 && "animate-fade-in-up")}
                style={i < 8
                  ? { animationDelay: `${210 + i * 40}ms` }
                  : { contentVisibility: "auto", containIntrinsicSize: "auto 60px" }}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/user/${user.user_id}`)}
                  className="w-full min-h-11 flex items-center gap-3 py-3 text-left"
                >
                  <span className={cn("w-6 shrink-0 font-display font-black text-sm tabular-nums", isMe ? "text-gold" : "text-muted-foreground")}>
                    {i + 4}
                  </span>
                  <StatusAvatar src={user.avatar_url} name={user.username} tier={user.status_tier || "recruit"} size="sm" animated={false} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <TierUsername username={user.username} tier={user.status_tier || "recruit"} className="min-w-0 truncate" />
                      {verifiedSet?.has(user.user_id) && (
                        <span
                          className="shrink-0 inline-flex items-center justify-center h-[15px] w-[15px] rounded-md bg-teal/15 border border-teal/30 text-teal"
                          aria-label="HealthKit-verified — unfakeable discipline"
                          title="Verified by Apple Health"
                        >
                          <ShieldCheck aria-hidden size={12} strokeWidth={2.6} />
                        </span>
                      )}
                      {isMe && <span className="shrink-0 text-[10px] text-muted-foreground font-medium">(you)</span>}
                    </span>
                    <span className="flex items-center gap-2 mt-0.5 text-[12px] text-muted-foreground">
                      <span>Lv {user.level}</span>
                      {user.streak > 0 && <StreakFlameInline streak={user.streak} suffix="d" className="text-[11px]" still />}
                      {wins > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <Medal aria-hidden size={11} /> {wins}×
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 font-display font-black text-sm tabular-nums">{fmtUnit(points(user), "XP")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Nobody on the board yet (fresh deploy / new season) — invite action.
          Gated on the ACTIVE mode's loading state so a cold cache doesn't flash
          "the board is warming up" before data lands. */}
      {!boardLoading && currentLeaders.length === 0 && (
        <div className="home-rise home-rise-2">
          <EmptyState
            icon={Trophy}
            title="The board is warming up"
            description="Be the first to check in and claim rank #1."
            action={<Button size="sm" onClick={() => navigate("/checkin")}>Check in now</Button>}
          />
        </div>
      )}

      {/* 1v1 Battles — friend challenges live under Ranks (no orphan route),
          as one quiet row below the board: rankings come first here. */}
      <div className="home-rise home-rise-4 mt-6 surface-card surface-card-quiet overflow-hidden">
        <SettingsRow
          icon={Swords}
          label="1v1 Battles"
          sub="Challenge a friend — winner takes the score"
          onClick={() => navigate("/battles")}
        />
      </div>

      {/* Secondary boards — different purposes (tribes, invites) collapsed so
          Ranks stays focused on the one question: where do I rank? */}
      <MoreSection label="More boards" className="mt-4">
        <TopTribesWidget />
        <TopInvitersWidget />
      </MoreSection>

      {championData?.recent?.length ? (
        <section className="mt-8">
          <h2 className="font-display font-bold text-base tracking-tight">Hall of Champions</h2>
          <ul className="mt-1 divide-y divide-border/35">
            {championData.recent.map((row) => (
              <li key={`${row.season_id}-${row.user_id}`} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <span className="truncate">@{row.username_snapshot || "unknown"}</span>
                <span className="shrink-0 text-muted-foreground">{row.season_name}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};

interface PodiumCardProps {
  user: LeaderRow;
  rank: 1 | 2 | 3;
  points: number;
  isMe: boolean;
  wins: number;
  onClick: () => void;
}

// Stepped heights keep the podium silhouette; only #1 wears the full surface
// and the gold border — #2 and #3 are quiet so the leader is the spectacle.
const PODIUM = {
  1: { label: "1st", shape: "pt-8 pb-5 border-gold/60" },
  2: { label: "2nd", shape: "surface-card-quiet pt-5 pb-4 mt-6" },
  3: { label: "3rd", shape: "surface-card-quiet pt-5 pb-3.5 mt-10" },
} as const;

const PodiumCard = ({ user, rank, points, isMe, wins, onClick }: PodiumCardProps) => {
  const isFirst = rank === 1;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "surface-card flex flex-col items-center px-2 text-center",
        PODIUM[rank].shape,
        isMe && "ring-1 ring-gold/40",
      )}
    >
      {isFirst && <Crown aria-hidden size={22} className="absolute -top-3 left-1/2 -translate-x-1/2 text-gold" />}
      <span className={cn("eyebrow-sm absolute top-2 right-2 tabular-nums", isFirst && "text-gold")}>
        {PODIUM[rank].label}
      </span>
      <StatusAvatar
        src={user.avatar_url}
        name={user.username}
        tier={user.status_tier || "recruit"}
        size={isFirst ? "md" : "sm"}
      />
      <TierUsername
        as="p"
        username={user.username}
        tier={user.status_tier || "recruit"}
        className="font-display font-bold text-xs mt-2 truncate max-w-full px-1"
      />
      {isMe && <span className="text-[10px] text-muted-foreground font-medium">(you)</span>}
      <p className={cn("font-display font-black tabular-nums mt-1", isFirst ? "text-gold text-lg" : "text-sm")}>
        {fmtUnit(points, "XP")}
      </p>
      {(user.streak > 0 || wins > 0) && (
        <span className="flex items-center gap-2 mt-1.5 text-[11px]">
          {user.streak > 0 && (
            <StreakFlameInline streak={user.streak} suffix="d" className={isFirst ? "text-[12px]" : "text-[11px]"} />
          )}
          {wins > 0 && (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <Medal aria-hidden size={11} /> {wins}×
            </span>
          )}
        </span>
      )}
    </button>
  );
};

export default Leaderboard;
