import { ChevronRight, Award, ArrowUp, Crown } from "lucide-react";
import AnimatedNumber from "@/components/AnimatedNumber";
import BadgeCard from "@/components/BadgeCard";
import TrialExpirySheet from "@/components/TrialExpirySheet";
import { track, FUNNEL } from "@/lib/analytics";
import TierRiskBanner from "@/components/TierRiskBanner";
import InviteCTA from "@/components/InviteCTA";
import CommandDeck from "@/components/home/CommandDeck";
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
import HealthKitConnectCard from "@/components/health/HealthKitConnectCard";
import { hasHealthConsent } from "@/lib/health/health-consent";
import { isNativePlatform } from "@/lib/platform";
import { useOnboardingTrigger, useSpotlightTarget } from "@/components/onboarding/onboarding-context";
import FuelZone from "@/components/nutrition/FuelZone";
import { localDateKey } from "@/components/nutrition/DateBar";
import { useNutritionTotals } from "@/hooks/use-nutrition-totals";
import { useNutritionTargets } from "@/hooks/use-nutrition-targets";
import { setPendingPhoto } from "@/lib/nutrition/pending-photo";
import { dayState, macroSummary } from "@/lib/nutrition/totals";
import { onIdle } from "@/lib/idle";
import { HomeSkeleton } from "@/components/skeletons/PageSkeleton";
// Pull-to-refresh removed temporarily — was intercepting inner taps.

const Index = () => {
  const navigate = useNavigate();

  // Prefetch the most-likely next screens once Home is idle, so the first tap
  // on Feed / Check-in opens instantly (no lazy-chunk wait). Touch devices
  // have no hover, so BottomNav's hover-prefetch never fires — this covers it.
  useEffect(() => onIdle(() => {
    import("@/pages/EliteFeed");
    import("@/pages/DailyCheckin");
  }, 2500), []);
  const { profile } = useAuth();
  // Contextual onboarding (Blueprint triggers): Today intro on first visit;
  // streak card once a streak exists; progression once XP exists (also
  // chained from STREAK_INTRO). Eligibility/dedup is the provider's job.
  useOnboardingTrigger("TODAY_INTRO", !!profile);
  useOnboardingTrigger("STREAK_INTRO", (profile?.streak ?? 0) > 0);
  useOnboardingTrigger("PROGRESSION_INTRO", (profile?.xp ?? 0) > 0);
  const progressionTargetRef = useSpotlightTarget("PROGRESSION_INTRO");
  // Fill health_sync_snapshots + health_night_metrics daily, not only when
  // the check-in/Profile screens happen to open (data holes starved trends).
  useBackgroundHealthSync();
  const { data: liveWhealth } = useLiveWhealthIndex();

  // The Apple Health card shows until Health is connected. Re-read on focus so
  // it disappears the moment the user returns from the iOS permission sheet,
  // instead of lingering until they navigate away and back.
  const [healthConnected, setHealthConnected] = useState(() => hasHealthConsent());
  useEffect(() => {
    const sync = () => setHealthConnected(hasHealthConsent());
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

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

  // The `coach_nudges` and `weekly_briefings` queries that used to live here
  // were removed: they ran on every Home mount for an Elite user and fed
  // CoachStrip's `latestNudge`/`latestBriefing` props, which the component
  // stopped reading long ago (nudges and briefings live inside /coach now).
  // Two Supabase round trips per Home load, consumed by nothing.

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
        .maybeSingle();
      return data;
    },
    enabled: !!profile,
  });

  const { data: rankData } = useMyRank(profile?.user_id);
  const tierRisk = useTierRisk({
    tier: profile?.status_tier || "recruit",
    rankScore: Number(profile?.rank_score) || 0,
    streak: profile?.streak || 0,
    lastCheckinAt: lastCheckin?.checked_in_at,
  });

  // Live rank delta for HeroHeader pulse line
  const pulse = useDailyPulse(
    profile?.user_id || "",
    rankData?.rank,            // undefined until loaded — do NOT coerce to 0 (poisons the snapshot)
    Number(profile?.rank_score) || 0,
    rankData?.totalUsers,
  );

  // ── Checkin-derived values (hooks must be before any early return) ────────
  // Shared with DailyCheckin — the window is the LOCAL CALENDAR DAY, so the
  // card unlocks at midnight (not 24h after the last check-in).
  const { canCheckin, timeUntilCheckin } = useCheckinDay(lastCheckin?.checked_in_at);

  // Fuel — today's kcal and protein against target. Both queries are cheap
  // and cached (30 s / 5 min); a failed read with nothing cached hides the
  // row rather than showing a wrong number.
  const fuelDate = localDateKey();
  const { day: fuelDay, isLoading: fuelLoading, error: fuelError } = useNutritionTotals(fuelDate);
  const { targets: fuelTargets, isLoading: fuelTargetsLoading } = useNutritionTargets();
  const fuelTotals = macroSummary(fuelDay?.totals ?? {});
  const fuelTargetMacros = fuelTargets
    ? { calories: fuelTargets.kcal, protein: fuelTargets.protein_g, carbs: fuelTargets.carbs_g, fat: fuelTargets.fat_g }
    : null;
  const fuelState = dayState(
    fuelDay?.totals ?? {},
    fuelTargets ? { kcal: fuelTargets.kcal, protein_g: fuelTargets.protein_g, carbs_g: fuelTargets.carbs_g, fat_g: fuelTargets.fat_g } : null,
  );

  // (First-W card removed — for a brand-new user the Command Deck IS the
  // first-W experience: "Start your streak. Earn XP. Climb." under the lava
  // CTA, and the opening line reads "Your first W is one tap away." A separate
  // dismissable card above it was a third thing competing to be first.)

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
    // Guarded like every other storage access in this file — a storage-denied
    // throw here would take down Home on the user's milestone day.
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch { return; }
    setMilestoneConfetti(true);
    toast.success(`${s}-day streak`, { description: MESSAGES[s], duration: 5500 });
    const t = setTimeout(() => setMilestoneConfetti(false), 2600);
    return () => clearTimeout(t);
  }, [profile?.streak]);

  // Same geometry as the auth-loading fallback — no blank frame between them.
  if (!profile) return <HomeSkeleton />;

  const xpToNext = profile.level * 500;
  const tier = profile.status_tier || "recruit";
  const tierConfig = getTierConfig(tier);
  const isLegend = tier === "legend";
  const isApex = tier === "apex";

  // Opening beat — the day, stated once. Ritual thesis: Home leads with the
  // act, framed by today. The line reacts to the day's state so the greeting
  // is never generic filler.
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const ritualLine = !canCheckin
    ? "Today is locked in."
    : profile.streak > 0
    ? "Keep the chain alive."
    : "Your first W is one tap away.";

  // Standing readout — rank is shown only when EARNED and sane (an unranked
  // recruit once read "#3 of 2"). Same guard as StatusNameplate.
  const rankSane =
    rankData?.hasRank === true &&
    (rankData.rank ?? 0) > 0 &&
    (rankData.totalUsers ?? 0) > 0 &&
    (rankData.rank ?? 0) <= (rankData.totalUsers ?? 0);

  // Tier-reactive page-level aura — softer, wider falloff
  const pageAura = isLegend
    ? "radial-gradient(ellipse 90% 70% at center top, hsl(280 70% 60% / 0.11) 0%, hsl(var(--gold) / 0.05) 45%, transparent 80%)"
    : isApex
    ? "radial-gradient(ellipse 90% 70% at center top, hsl(var(--ember) / 0.10) 0%, hsl(var(--gold) / 0.04) 45%, transparent 80%)"
    : tier === "elite"
    ? "radial-gradient(ellipse 90% 70% at center top, hsl(var(--gold) / 0.10) 0%, hsl(180 70% 50% / 0.04) 45%, transparent 80%)"
    : "radial-gradient(ellipse 90% 70% at center top, hsl(var(--gold) / 0.075) 0%, hsl(var(--gold) / 0.025) 45%, transparent 80%)";

  return (
    <div className="min-h-full pb-6 px-4 pt-3 relative">
      {milestoneConfetti && (
        <Portal>
          <div className="fixed inset-0 pointer-events-none z-[var(--z-toast)]">
            <ConfettiBurst active={milestoneConfetti} />
          </div>
        </Portal>
      )}
      {/* Tier-reactive top aura — slowly breathing so the dark ground reads
          alive and expensive, never a flat backdrop. */}
      <div
        aria-hidden
        className="page-aura-live absolute top-0 left-1/2 -translate-x-1/2 w-[760px] h-[460px] pointer-events-none z-0"
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
                : "radial-gradient(ellipse 70% 100% at 50% 0%, hsl(var(--ember) / 0.18) 0%, hsl(var(--gold) / 0.08) 45%, transparent 80%)",
          }}
        />
      )}

      <div
        className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none z-10 opacity-25"
        style={{
          background:
            "linear-gradient(90deg, transparent 10%, hsl(var(--gold) / 0.6) 50%, transparent 90%)",
        }}
      />

      {/* ── OPENING BEAT — the day, stated once. Type on the page, not a card:
             the first thing the eye meets is a voice, and the hero below gets
             air instead of a stat strip crowding it. ── */}
      <header className="home-rise relative z-10 pt-0.5">
        <p className="eyebrow text-muted-foreground/75">{weekday} · {monthDay}</p>
        <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight mt-1.5">
          {ritualLine}
        </h1>
      </header>

      {/* ── HERO — the one daily act, framed as the hero with real room above
             and below. The lava CTA is the screen's single spectacle. ── */}
      <div className="home-rise home-rise-1 mt-4 mb-6 relative z-10">
        <CommandDeck
          streak={profile.streak}
          longestStreak={profile.longest_streak}
          lastCheckinAt={lastCheckin?.checked_in_at}
          canCheckin={canCheckin}
          timeUntilCheckin={timeUntilCheckin}
          tier={tier}
        />
      </div>

      {/* TIER RISK — urgent, sits directly under the act it protects. */}
      {tierRisk.level !== "safe" && (
        <div className="home-rise home-rise-2 mb-6 relative z-10">
          <TierRiskBanner risk={tierRisk} />
        </div>
      )}

      {/* ── STANDING — where you stand today. A quiet status line, not a metric
             wall: one row, values inline, W-Index the single gold note. Demoted
             below the act (ritual leads, standing follows) and hidden entirely
             until there's something earned to show. Carries PROGRESSION_INTRO. ── */}
      {(rankSane || liveWhealth?.overall != null || profile.level > 1) && (
        <div
          ref={progressionTargetRef}
          className="home-rise home-rise-2 relative z-10 mb-6 surface-card surface-card-quiet flex items-center"
        >
          <button
            type="button"
            onClick={() => navigate("/leaderboard")}
            aria-label="Open Ranks"
            className="flex-1 flex items-baseline gap-x-3 gap-y-0.5 flex-wrap px-4 py-3 text-left active:opacity-70 transition-opacity"
          >
            {rankSane && (
              <span className="inline-flex items-baseline gap-1">
                <span className="font-display font-black text-[17px] tabular-nums leading-none">
                  #<AnimatedNumber value={rankData!.rank} duration={700} />
                </span>
                <span className="text-[11px] text-muted-foreground">of {(rankData?.totalUsers ?? 0).toLocaleString()}</span>
              </span>
            )}
            <span className="inline-flex items-baseline gap-1">
              <span className="font-display font-black text-[17px] tabular-nums leading-none">Lv {profile.level}</span>
              <span className="text-[11px] text-muted-foreground">
                <AnimatedNumber value={Math.max(0, xpToNext - profile.xp)} duration={900} /> XP to go
              </span>
            </span>
          </button>
          {pulse.hasSnapshot && pulse.rankDelta > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-teal/12 px-2 py-1 mr-2 text-[11px] font-black text-teal">
              <ArrowUp aria-hidden size={11} strokeWidth={3} /> {pulse.rankDelta}
            </span>
          )}
          {liveWhealth?.overall != null && (
            <button
              type="button"
              aria-label="Open your Whealth Index"
              onClick={() => navigate("/journey")}
              className="shrink-0 flex flex-col items-end pr-4 pl-3 py-3 border-l border-border/40 active:opacity-70 transition-opacity"
            >
              <span className="eyebrow text-gold/85 leading-none">W-Index</span>
              <span className="font-display font-black text-[17px] tabular-nums leading-none text-gold glow-gold-text mt-1 inline-flex items-center gap-1">
                <Crown size={13} strokeWidth={2.8} aria-hidden /> {liveWhealth.overall}
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── FUEL — today's kcal and protein against target, and the two ways
             in (log, or a photo of the plate). A quiet row with no gold of its
             own: the hero and the W-Index keep Home's whole gold budget. ── */}
      <div className="home-rise home-rise-3 mb-6 relative z-10">
        <ErrorBoundary fallback={<div className="h-0" aria-hidden />}>
          <FuelZone
            loading={fuelLoading || fuelTargetsLoading}
            totals={fuelTotals}
            targets={fuelTargetMacros}
            state={fuelState}
            unavailable={!!fuelError && !fuelDay}
            onOpenDiary={() => navigate("/nutrition")}
            onOpenTargets={() => navigate("/nutrition/targets")}
            onLog={() => navigate("/nutrition?add=1")}
            onPhoto={(file) => {
              setPendingPhoto(file);
              navigate("/nutrition/photo");
            }}
          />
        </ErrorBoundary>
      </div>

      {/* APPLE HEALTH — the ask that makes check-ins verifiable. Native only,
          until connected; renders nothing on web/Android. */}
      {isNativePlatform() && !healthConnected && (
        <div className="home-rise home-rise-4 mb-6 relative z-10">
          <ErrorBoundary fallback={<div className="h-0" aria-hidden />}>
            <HealthKitConnectCard onConnected={() => setHealthConnected(true)} />
          </ErrorBoundary>
        </div>
      )}

      {/* ── COACH — a whisper, not a card. The coach's one line in its own
             voice; a low quiet band so it reads as a presence, never a second
             button competing with the hero. ── */}
      <div className="home-rise home-rise-4 mb-6 relative z-10">
        <ErrorBoundary fallback={<div className="h-0" aria-hidden />}>
          <CoachStrip />
        </ErrorBoundary>
      </div>

      {/* ── THE LIBRARY — one zone: the day's thought to read (a pull-quote
             from the Vault) leading a clean shelf of what the membership
             unlocks. Two shapes, one grammar — the card-soup is gone. ── */}
      <div className="home-rise home-rise-5 mb-6 relative z-10">
        <DailyInsightCard />
        <div className="mt-3">
          <LibraryHub />
        </div>
      </div>

      {/* SECONDARY — Today stays focused. Invite + badges one tap under "More". */}
      <MoreSection label="More" className="relative z-10 mt-1 mb-2">
      {/* EARN FREE MEMBERSHIP — referral CTA */}
      <Reveal className="mb-4 relative z-10" delay={0}>
        <InviteCTA referralCount={profile.referral_count || 0} />
      </Reveal>
      {/* Recent Badges */}
      <Reveal className="mb-2" delay={80}>
        <div className="flex items-end justify-between mb-3 px-0.5">
          <div className="flex flex-col">
            <span className="eyebrow mb-1">Achievements</span>
            <h2 className="font-display font-bold text-base tracking-tight leading-none">
              Recent Badges
            </h2>
          </div>
          <button
            onClick={() => navigate("/profile")}
            className="flex items-center gap-0.5 text-xs text-gold font-semibold active:opacity-70 transition-opacity"
          >
            View all <ChevronRight aria-hidden size={13} />
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
                  Lock today <ChevronRight aria-hidden size={12} />
                </button>
              ) : null
            }
          />
        )}
      </Reveal>
      </MoreSection>

      {/* Tier message footer — boosted contrast (was muted-foreground/40 → barely visible) */}
      <div className="mt-6 mb-2 text-center">
        <p className="text-[11px] text-muted-foreground font-semibold tracking-[0.22em] uppercase">
          {tierConfig.message}
        </p>
      </div>

      {/* Trial-end conversion moment — one-shot value recap + upgrade CTA. */}
      <TrialExpirySheet />
    </div>
  );
};

export default Index;
