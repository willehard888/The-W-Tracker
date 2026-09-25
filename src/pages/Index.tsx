import { ArrowUp, Sparkles } from "lucide-react";
import { XP_PER_LEVEL } from "@/lib/checkin-xp";
import { useTrialAccess } from "@/hooks/use-trial-access";
import { useLastCheckin } from "@/hooks/use-last-checkin";
import { fmtDate } from "@/lib/format";
import { fmtInt } from "@/lib/format";
import AnimatedNumber from "@/components/AnimatedNumber";
import TierRiskBanner from "@/components/TierRiskBanner";
import CommandDeck from "@/components/home/CommandDeck";
import TrainingZone from "@/components/coach/TrainingZone";
import DailyInsightCard from "@/components/home/DailyInsightCard";
import LibraryHub from "@/components/home/LibraryHub";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ErrorState from "@/components/ui/error-state";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ConfettiBurst from "@/components/ConfettiBurst";
import { Portal } from "@/components/ui/Portal";
import { useTierRisk } from "@/hooks/use-tier-risk";
import { useCheckinDay } from "@/hooks/use-checkin-day";
import { useMyRank } from "@/hooks/use-my-rank";
import { useDailyPulse } from "@/hooks/use-daily-pulse";
import { useBackgroundHealthSync } from "@/hooks/use-background-health-sync";
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
  const { profile, refreshProfile } = useAuth();
  const { hasAccess } = useTrialAccess();
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


  // The `coach_nudges` and `weekly_briefings` queries that used to live here
  // were removed: they ran on every Home mount for an Elite user and fed the
  // old coach card's props, which it stopped reading long ago (nudges and
  // briefings live inside /coach now; the card itself left Home when the
  // coach door moved into the standing strip). Two round trips for nothing.


  const { data: lastCheckin } = useLastCheckin(profile?.user_id);

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
    profile?.last_rank_snapshot,
  );

  // ── Checkin-derived values (hooks must be before any early return) ────────
  // Shared with DailyCheckin — the window is the LOCAL CALENDAR DAY, so the
  // card unlocks at midnight (not 24h after the last check-in).
  const { canCheckin } = useCheckinDay(lastCheckin?.checked_in_at);

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

  // A skeleton is a promise that something is coming. AuthContext races
  // fetchProfile against 8s and falls through, so a hung fetch left Home on an
  // infinite skeleton with no error branch and no retry — give the wait a
  // deadline of its own.
  const [profileStalled, setProfileStalled] = useState(false);
  useEffect(() => {
    if (profile || profileStalled) return;
    const t = setTimeout(() => setProfileStalled(true), 8000);
    return () => clearTimeout(t);
  }, [profile, profileStalled]);

  // Same geometry as the auth-loading fallback — no blank frame between them.
  if (!profile) {
    if (!profileStalled) return <HomeSkeleton />;
    return (
      <div className="min-h-full px-4 pt-16">
        <ErrorState
          title="Couldn't load your day"
          description="Your profile didn't come back. Check your connection and try again."
          onRetry={() => {
            setProfileStalled(false); // back to the skeleton, deadline re-armed
            void refreshProfile();
          }}
        />
      </div>
    );
  }

  const xpToNext = profile.level * XP_PER_LEVEL;
  const tier = profile.status_tier || "recruit";

  // Opening beat — the day, and only the day.
  //
  // A four-state ritual line used to sit under this date: "Keep the chain
  // alive.", "Today is locked in.", and two more. It is gone, and the date
  // takes the beat rather than the screen opening on an 11px line above a
  // 174px card. What the line said, the card under it now says better and
  // once — the streak is on its own face ("Defend your 3-day streak."), a
  // locked day collapses the card to "Day banked", and the risk banner has
  // the deadline. The greeting was the third place saying the same thing.
  const now = new Date();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = fmtDate(now);

  // Standing readout — rank is shown only when EARNED and sane (an unranked
  // recruit once read "#3 of 2"). Same guard as StatusNameplate.
  const rankSane =
    rankData?.hasRank === true &&
    (rankData.rank ?? 0) > 0 &&
    (rankData.totalUsers ?? 0) > 0 &&
    (rankData.rank ?? 0) <= (rankData.totalUsers ?? 0);

  return (
    <div className="min-h-full pb-6 px-4 pt-3">
      {milestoneConfetti && (
        <Portal>
          <div className="fixed inset-0 pointer-events-none z-[var(--z-toast)]">
            <ConfettiBurst active={milestoneConfetti} />
          </div>
        </Portal>
      )}

      {/* ── OPENING BEAT — the day, stated once. Type on the page, not a card.
             Three decorative layers used to sit behind it: a breathing aura, an
             ember band and a gold hairline. On a screen that is now type and
             photographs on black ground, they were atmosphere competing with
             content — the empty space does that work. ── */}
      <header className="home-rise pt-0.5">
        <h1 className="font-display font-black text-beat leading-[1.04] tracking-tight">
          {weekday}
          <span className="text-muted-foreground"> · {monthDay}</span>
        </h1>
      </header>

      {/* ── THE ACT — the one daily thing. The screen's single spectacle, and
             the only block that keeps a frame of its own, because the frame IS
             the button. ── */}
      <div className="home-rise home-rise-1 mt-5">
        <CommandDeck
          streak={profile.streak}
          longestStreak={profile.longest_streak}
          lastCheckinAt={lastCheckin?.checked_in_at}
          canCheckin={canCheckin}
          tier={tier}
        />
      </div>

      {/* TIER RISK — urgent, directly under the act it protects. */}
      {tierRisk.level !== "safe" && (
        <div className="home-rise home-rise-2 mt-5">
          <TierRiskBanner risk={tierRisk} />
        </div>
      )}

      {/* ── FUEL — what is left of today. No card: the number leads, and on a
             day with nothing in it the app's own recipe photography leads
             instead. No gold — the act keeps Home's whole gold budget. ── */}
      <div className="home-rise home-rise-3 mt-8">
        <ErrorBoundary fallback={<div className="h-0" aria-hidden />}>
          <FuelZone
            loading={fuelLoading || fuelTargetsLoading}
            totals={fuelTotals}
            targets={fuelTargetMacros}
            state={fuelState}
            mealCount={fuelDay?.meal_count ?? 0}
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

      {/* ── TRAINING — today's session, with the first movement drawn edge to
             edge. Same grammar as Fuel, no gold of its own. ── */}
      {hasAccess && (
        <div className="home-rise home-rise-4 mt-8">
          <ErrorBoundary fallback={<div className="h-0" aria-hidden />}>
            <TrainingZone />
          </ErrorBoundary>
        </div>
      )}

      {/* ── STANDING + THE COACH — one hairline row: where you stand on the
             left, the coach's door on the right. The coach is the one gold
             note below the act. Carries PROGRESSION_INTRO. ── */}
      <div
        ref={progressionTargetRef}
        className="home-rise home-rise-5 mt-8 flex items-center border-t border-border/35"
      >
        <button
          type="button"
          onClick={() => navigate("/leaderboard")}
          aria-label="Open Ranks"
          className="flex-1 min-h-14 flex items-baseline gap-x-3 gap-y-0.5 flex-wrap py-3 text-left active:opacity-70 transition-opacity"
        >
          {rankSane && (
            <span className="inline-flex items-baseline gap-1">
              <span className="font-display font-black text-lead tabular-nums leading-none">
                #<AnimatedNumber value={rankData!.rank} duration={700} />
              </span>
              {/* "by rating" because the app has two boards: this is
                  `get_user_rank` (the 28-day rating that decides your tier)
                  and the Ranks tab opens on this month's XP. The same
                  account read "#3 of 6" here and "#5 of 5" one tap away. */}
              <span className="text-label text-muted-foreground">of {fmtInt(rankData?.totalUsers ?? 0)} by rating</span>
            </span>
          )}
          <span className="inline-flex items-baseline gap-1">
            <span className="font-display font-black text-lead tabular-nums leading-none">Lv {profile.level}</span>
            <span className="text-label text-muted-foreground">
              <AnimatedNumber value={Math.max(0, xpToNext - profile.xp)} duration={900} /> XP to go
            </span>
          </span>
        </button>
        {pulse.hasSnapshot && pulse.rankDelta > 0 && (
          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-teal/12 px-2 py-1 mr-2 text-label font-black text-teal">
            <ArrowUp aria-hidden size={11} strokeWidth={3} /> {pulse.rankDelta}
          </span>
        )}
        <button
          type="button"
          aria-label="Ask your AI Coach"
          onClick={() => navigate("/coach?chat=1")}
          className="shrink-0 min-h-14 flex items-center gap-1.5 pl-4 py-3 font-display font-black text-lead text-gold glow-gold-text active:opacity-70 transition-opacity"
        >
          <Sparkles size={14} strokeWidth={2.8} aria-hidden /> Ask
        </button>
      </div>

      {/* ── THE LIBRARY — below the day's work, where a menu belongs: the day's
             thought to read, then what the membership unlocks as three rows.
             The invite card and the badge grid that used to sit under "More"
             are gone from here — both already live on Profile, the badge vault
             in full and the invite with its own count, so Home was carrying a
             second copy of each. ── */}
      <div className="home-rise home-rise-5 mt-10">
        <DailyInsightCard />
        <div className="mt-5">
          <LibraryHub />
        </div>
      </div>
    </div>
  );
};

export default Index;
