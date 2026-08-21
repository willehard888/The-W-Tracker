import { ChevronRight, Award, ArrowUp, Crown } from "lucide-react";
import AnimatedNumber from "@/components/AnimatedNumber";
import BadgeCard from "@/components/BadgeCard";
import TrialExpirySheet from "@/components/TrialExpirySheet";
import { track, FUNNEL } from "@/lib/analytics";
import TierRiskBanner from "@/components/TierRiskBanner";
import InviteCTA from "@/components/InviteCTA";
import CommandDeck from "@/components/home/CommandDeck";
import PodCard from "@/components/home/PodCard";
import CoachStrip from "@/components/home/CoachStrip";
import DailyInsightCard from "@/components/home/DailyInsightCard";
import LibraryHub from "@/components/home/LibraryHub";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Reveal from "@/components/home/Reveal";
import EmptyState from "@/components/ui/empty-state";
import MoreSection from "@/components/ui/more-section";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ConfettiBurst from "@/components/ConfettiBurst";
import { Portal } from "@/components/ui/Portal";
import { supabase } from "@/integrations/supabase/client";
import { getTierConfig } from "@/lib/status-tiers";
import { useTierRisk } from "@/hooks/use-tier-risk";
import { useCheckinDay } from "@/hooks/use-checkin-day";
import { useMyRank } from "@/hooks/use-my-rank";
import { useDailyPulse } from "@/hooks/use-daily-pulse";
import { useBackgroundHealthSync } from "@/hooks/use-background-health-sync";
import { useLiveWhealthIndex } from "@/hooks/use-live-whealth-index";
// Pull-to-refresh removed temporarily — was intercepting inner taps.

const Index = () => {
  const navigate = useNavigate();

  // Prefetch the most-likely next screens once Home is idle, so the first tap
  // on Feed / Check-in opens instantly (no lazy-chunk wait). Touch devices
  // have no hover, so BottomNav's hover-prefetch never fires — this covers it.
  useEffect(() => {
    const prefetch = () => {
      import("@/pages/EliteFeed");
      import("@/pages/DailyCheckin");
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) {
      const id = ric(prefetch, { timeout: 2500 });
      return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = setTimeout(prefetch, 1500);
    return () => clearTimeout(t);
  }, []);
  const { profile, isElite } = useAuth();
  // Fill health_sync_snapshots + health_night_metrics daily, not only when
  // the check-in/Profile screens happen to open (data holes starved trends).
  useBackgroundHealthSync();
  const { data: liveWhealth } = useLiveWhealthIndex();

  // trial_started — fired once per user when their trial window is fresh
  // (<48h old). Without this event, trial→paid conversion was unmeasurable.
  useEffect(() => {
    const uid = profile?.user_id;
    const startedAt = profile?.trial_started_at ? new Date(profile.trial_started_at).getTime() : NaN;
    if (!uid || !Number.isFinite(startedAt)) return;
    if (Date.now() - startedAt > 48 * 60 * 60 * 1000) return;
    const key = `trial_started_tracked_${uid}`;
    try {
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
    } catch { return; }
    void track(FUNNEL.trialStarted);
  }, [profile?.user_id, profile?.trial_started_at]);

  const { data: latestNudge } = useQuery({
    queryKey: ["latest-coach-nudge", profile?.user_id],
    staleTime: 5 * 60_000,   // nudges don't change every second
    gcTime:    10 * 60_000,
    queryFn: async () => {
      if (!profile || !isElite) return null;
      const { data } = await supabase
        .from("coach_nudges")
        .select("id, headline, content, seen_at, created_at")
        .eq("user_id", profile.user_id)
        .is("seen_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!profile && isElite,
  });

  const { data: latestBriefing } = useQuery({
    queryKey: ["latest-briefing", profile?.user_id],
    staleTime: 60 * 60_000,  // weekly briefings are stable for an hour
    gcTime:    2  * 60 * 60_000,
    queryFn: async () => {
      if (!profile || !isElite) return null;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("weekly_briefings")
        .select("id, headline, viewed_at, generated_at")
        .eq("user_id", profile.user_id)
        .gte("generated_at", sevenDaysAgo)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!profile && isElite,
  });

  const { data: userBadges } = useQuery({
    queryKey: ["user-badges", profile?.user_id],
    staleTime: 10 * 60_000,  // badges change only after check-in
    gcTime:    30 * 60_000,
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("user_badges")
        .select("*, badges(*)")
        .eq("user_id", profile.user_id)
        .order("earned_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: lastCheckin } = useQuery({
    queryKey: ["last-checkin", profile?.user_id],
    staleTime: 5 * 60_000,   // window is the local calendar day — 5 min stale is fine
    gcTime:    30 * 60_000,
    queryFn: async () => {
      if (!profile) return null;
      const { data } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", profile.user_id)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!profile,
  });

  const { data: rankData } = useMyRank(profile?.user_id);
  const tierRisk = useTierRisk({
    tier: profile?.status_tier || "recruit",
    rankScore: Number((profile as any)?.rank_score) || 0,
    streak: profile?.streak || 0,
    lastCheckinAt: lastCheckin?.checked_in_at,
  });

  // Live rank delta for HeroHeader pulse line
  const pulse = useDailyPulse(
    profile?.user_id || "",
    rankData?.rank,            // undefined until loaded — do NOT coerce to 0 (poisons the snapshot)
    Number((profile as any)?.rank_score) || 0,
    rankData?.totalUsers,
  );

  // ── Checkin-derived values (hooks must be before any early return) ────────
  // Shared with DailyCheckin — the window is the LOCAL CALENDAR DAY, so the
  // card unlocks at midnight (not 24h after the last check-in).
  const { canCheckin, timeUntilCheckin } = useCheckinDay(lastCheckin?.checked_in_at);

  // First-W guidance — one-shot card for a brand-new user who landed on Home
  // without checking in (e.g. skipped onboarding). Auto-hides forever once a
  // check-in exists; dismissable via the same per-user localStorage pattern
  // as the check-in first-run card.
  const [firstWDismissed, setFirstWDismissed] = useState(true);
  useEffect(() => {
    if (!profile?.user_id) return;
    try { setFirstWDismissed(!!localStorage.getItem(`w_home_firstw_${profile.user_id}`)); }
    catch { setFirstWDismissed(false); }
  }, [profile?.user_id]);
  const dismissFirstW = () => {
    setFirstWDismissed(true);
    try { localStorage.setItem(`w_home_firstw_${profile!.user_id}`, "1"); } catch { /* noop */ }
  };
  const showFirstW = !firstWDismissed && !lastCheckin && (profile?.streak ?? 0) === 0;

  // Streak-milestone moment — 7/30/100/365 days should FEEL like a win on the
  // screen you open most, not pass silently. Fires once per milestone (guarded
  // in localStorage) with confetti + a premium-voiced toast.
  const [milestoneConfetti, setMilestoneConfetti] = useState(false);
  useEffect(() => {
    const s = profile?.streak ?? 0;
    const MESSAGES: Record<number, string> = {
      7: "One week unbroken. The chain is real.",
      30: "30 days — this is where most quit. Not you.",
      100: "Triple digits. Elite territory. Rare air.",
      365: "A full year. You've become undeniable.",
    };
    if (!(s in MESSAGES)) return;
    const key = `streak_milestone_seen_${profile?.user_id}_${s}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    setMilestoneConfetti(true);
    toast.success(`🔥 ${s}-day streak`, { description: MESSAGES[s], duration: 5500 });
    const t = setTimeout(() => setMilestoneConfetti(false), 2600);
    return () => clearTimeout(t);
  }, [profile?.streak]);

  if (!profile) return null;

  const xpToNext = profile.level * 500;
  const tier = profile.status_tier || "recruit";
  const tierConfig = getTierConfig(tier);
  const isLegend = tier === "legend";
  const isApex = tier === "apex";

  // Tier-reactive page-level aura — softer, wider falloff
  const pageAura = isLegend
    ? "radial-gradient(ellipse 90% 70% at center top, hsl(280 70% 60% / 0.11) 0%, hsl(var(--gold) / 0.05) 45%, transparent 80%)"
    : isApex
    ? "radial-gradient(ellipse 90% 70% at center top, hsl(var(--ember) / 0.10) 0%, hsl(var(--gold) / 0.04) 45%, transparent 80%)"
    : tier === "elite"
    ? "radial-gradient(ellipse 90% 70% at center top, hsl(var(--gold) / 0.10) 0%, hsl(180 70% 50% / 0.04) 45%, transparent 80%)"
    : "radial-gradient(ellipse 90% 70% at center top, hsl(var(--gold) / 0.075) 0%, hsl(var(--gold) / 0.025) 45%, transparent 80%)";

  return (
    <div className="h-full pb-6 px-4 pt-3 relative overflow-y-auto overflow-x-hidden">
      {milestoneConfetti && (
        <Portal>
          <div className="fixed inset-0 pointer-events-none z-[var(--z-toast)]">
            <ConfettiBurst active={milestoneConfetti} />
          </div>
        </Portal>
      )}
      {/* Tier-reactive top aura */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[760px] h-[460px] pointer-events-none z-0"
        style={{ background: pageAura }}
      />

      {/* Ember band — soft fire-in-the-distance warmth tied to user's streak */}
      {profile.streak >= 3 && (
        <div
          aria-hidden
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[180px] pointer-events-none z-0 opacity-70"
          style={{
            background:
              isApex
                ? "radial-gradient(ellipse 70% 100% at 50% 0%, hsl(var(--ember) / 0.22) 0%, hsl(var(--gold) / 0.10) 40%, transparent 75%)"
                : isLegend
                ? "radial-gradient(ellipse 70% 100% at 50% 0%, hsl(280 70% 60% / 0.20) 0%, hsl(var(--gold) / 0.10) 40%, transparent 75%)"
                : "radial-gradient(ellipse 70% 100% at 50% 0%, hsl(18 92% 56% / 0.18) 0%, hsl(var(--gold) / 0.08) 45%, transparent 80%)",
          }}
        />
      )}

      <div
        className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none z-10 opacity-25"
        style={{
          background:
            "linear-gradient(90deg, transparent 10%, hsl(var(--gold) / 0.6) 50%, transparent 90%)",
          animation: "shimmer-slide 6s ease-in-out infinite",
        }}
      />

      {/* STATUS STRIP — earned tier + rank + today's climb. The daily "worth it"
          flex, and it renders the rank delta (pulse) that was computed-but-dropped. */}
      <div className="animate-reveal mb-3 relative z-10">
        <button
          onClick={() => navigate("/leaderboard")}
          className="w-full flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 px-3.5 py-2.5 text-left active:scale-[0.99] transition-transform"
        >
          <span className="text-xl leading-none shrink-0">{tierConfig.emoji}</span>
          <div className="min-w-0 flex-1">
            {/* Rank shows only when EARNED and sane (hasRank, rank ≤ total) —
                an unranked recruit once read "#3 of 2" here. Same guard rule
                as StatusNameplate. */}
            {(() => {
              const sane =
                rankData?.hasRank === true &&
                (rankData.rank ?? 0) > 0 &&
                (rankData.totalUsers ?? 0) > 0 &&
                rankData.rank! <= rankData.totalUsers!;
              return (
                <>
                  <p className="text-[13px] font-black leading-tight truncate">
                    {tierConfig.label}
                    {sane && (
                      <span className="text-muted-foreground font-semibold"> · #<AnimatedNumber value={rankData!.rank} duration={700} /></span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {sane
                      ? `of ${(rankData?.totalUsers ?? 0).toLocaleString()} · Lv ${profile.level} · ${Math.max(0, xpToNext - profile.xp)} XP to Lv ${profile.level + 1}`
                      : "Your climb starts today"}
                  </p>
                </>
              );
            })()}
          </div>
          {/* W-Index chip — the flagship number, felt daily. span+role (not a
              nested <button>) because the whole strip is already a button. */}
          {liveWhealth?.overall != null && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Open your Whealth Index"
              onClick={(e) => { e.stopPropagation(); navigate("/journey"); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); navigate("/journey"); } }}
              className="shrink-0 inline-flex items-center gap-1 rounded-full bg-gold/10 border border-gold/30 px-2 py-1 text-[10px] font-black text-gold tabular-nums active:scale-95 transition"
            >
              <Crown size={10} strokeWidth={2.8} /> {liveWhealth.overall}
            </span>
          )}
          {pulse.hasSnapshot && pulse.rankDelta > 0 ? (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-teal/12 px-2 py-1 text-[10px] font-black text-teal">
              <ArrowUp size={11} strokeWidth={3} /> {pulse.rankDelta} today
            </span>
          ) : (
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          )}
        </button>
      </div>

      {/* FIRST W — one-shot bridge for a new user who hasn't checked in yet */}
      {showFirstW && (
        <div className="animate-reveal mb-3 relative z-10">
          <div className="relative rounded-2xl border border-gold/35 bg-gradient-to-r from-gold/10 via-card/60 to-card/60 p-3.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/checkin")}
              className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.99] transition-transform"
            >
              <span className="h-9 w-9 rounded-xl gradient-gold flex items-center justify-center shrink-0">
                <ArrowUp size={16} className="text-primary-foreground rotate-45" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black text-foreground leading-tight">
                  Your first W is one tap away
                </span>
                <span className="block text-xs text-muted-foreground leading-tight mt-0.5">
                  One 60-second check-in starts the streak.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={dismissFirstW}
              aria-label="Dismiss"
              className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* COMMAND DECK — Streak + Lock Your Day */}
      <div className="animate-reveal mb-4 relative z-10">
        <CommandDeck
          streak={profile.streak}
          longestStreak={profile.longest_streak}
          lastCheckinAt={lastCheckin?.checked_in_at}
          canCheckin={canCheckin}
          timeUntilCheckin={timeUntilCheckin}
          tier={tier}
        />
      </div>

      {/* TIER RISK */}
      {tierRisk.level !== "safe" && (
        <Reveal className="mb-4 relative z-10" delay={0}>
          <TierRiskBanner risk={tierRisk} />
        </Reveal>
      )}

      {/* AI COACH — the brain of the app. Elevated right under the daily loop
          so the coach is present every day (it frames today + answers
          anything). Content (Vault, recipes) now lives one tap away under More
          and inside Coach, keeping Today focused on the one job. */}
      <Reveal className="mb-4 relative z-10" delay={80}>
        <ErrorBoundary fallback={<div className="h-0" aria-hidden />}>
          <CoachStrip latestNudge={latestNudge ?? null} latestBriefing={latestBriefing ?? null} />
        </ErrorBoundary>
      </Reveal>

      {/* DAILY INSIGHT — one Inner Work idea per day, deep-links to the Vault
          lesson. Between coach and content so the mind gets fed daily too. */}
      <Reveal className="mb-4 relative z-10" delay={90}>
        <DailyInsightCard />
      </Reveal>

      {/* THE LIBRARY — one premium hub for everything the membership unlocks
          (recipes, exercises, Vault). Replaces three stacked same-weight
          cards; founder feedback: too many buttons, combine with value. */}
      <Reveal className="mb-4 relative z-10" delay={100}>
        <LibraryHub />
      </Reveal>
      {/* ACCOUNTABILITY POD — your 3-5 who see your daily check-in. Moved
          below The Library (founder call): the daily loop + coach lead the
          page, the social layer follows the content hub. */}
      <Reveal className="mb-4 relative z-10" delay={110}>
        <ErrorBoundary fallback={<div className="h-0" aria-hidden />}>
          <PodCard />
        </ErrorBoundary>
      </Reveal>

      {/* SECONDARY — Today stays focused: check in, the AI move, the pod,
          daily insight and ONE library card. Invite + badges are one tap
          away under "More". */}
      <MoreSection label="More" className="relative z-10 mt-1 mb-2">
      {/* EARN FREE MEMBERSHIP — referral CTA */}
      <Reveal className="mb-4 relative z-10" delay={80}>
        <InviteCTA referralCount={profile.referral_count || 0} />
      </Reveal>
      {/* Recent Badges */}
      <Reveal className="mb-2" delay={320}>
        <div className="flex items-end justify-between mb-3 px-0.5">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/80 mb-1">
              Achievements
            </span>
            <h2 className="font-display font-bold text-base tracking-tight leading-none">
              Recent Badges
            </h2>
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-0.5 text-xs text-gold font-semibold active:opacity-70 transition-opacity"
          >
            View all <ChevronRight size={13} />
          </button>
        </div>
        {userBadges && userBadges.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {userBadges.map((ub: any) => (
              <BadgeCard
                key={ub.id}
                name={ub.badges.name}
                icon={ub.badges.icon}
                rarity={ub.badges.rarity}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Award}
            title="No badges yet"
            description="Lock your day to start earning — first badge unlocks at a 3-day streak."
            action={
              canCheckin ? (
                <button
                  onClick={() => navigate("/checkin")}
                  className="text-xs font-bold text-gold active:opacity-70 transition-opacity inline-flex items-center gap-1"
                >
                  Lock today <ChevronRight size={12} />
                </button>
              ) : null
            }
          />
        )}
      </Reveal>
      </MoreSection>

      {/* Tier message footer — boosted contrast (was muted-foreground/40 → barely visible) */}
      <div className="mt-6 mb-2 text-center">
        <p className="text-[10px] text-muted-foreground/60 font-semibold tracking-[0.22em] uppercase">
          {tierConfig.message}
        </p>
      </div>

      {/* Trial-end conversion moment — one-shot value recap + upgrade CTA. */}
      <TrialExpirySheet />
    </div>
  );
};

export default Index;
