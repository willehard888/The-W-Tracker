import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Moon, Dumbbell, Snowflake, Apple, Droplets, BookOpen,
  Brain, Smartphone, Camera, Zap, Plus,
  TrendingUp, AlertTriangle, Trophy, Crown, ChevronDown, NotebookPen,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import BadgeUnlockModal from "@/components/BadgeUnlockModal";
import { checkAndAwardBadges } from "@/lib/badge-awards";
import ConfettiBurst from "@/components/ConfettiBurst";
import DailyQuests from "@/components/DailyQuests";
import LevelUpCelebration from "@/components/LevelUpCelebration";
import { syncStreakWarningNotification } from "@/lib/streak-notifications";
import { useModeration } from "@/hooks/use-moderation";
import ModerationGate from "@/components/ModerationGate";
import { hapticImpact, hapticNotification, hapticSelection } from "@/lib/haptics";
import { triggerGust } from "@/lib/wind";
import { ELITE_XP_MULTIPLIER } from "@/lib/xp-constants";
import CheckinTierHeader from "@/components/CheckinTierHeader";
import CheckinTierSummary from "@/components/CheckinTierSummary";
import { useUserHabits } from "@/hooks/use-user-habits";
import { PROTOCOLS } from "@/lib/wellness-framework";
import { useHealthKit } from "@/hooks/use-healthkit";

interface ToggleItemProps {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  active: boolean;
  onToggle: () => void;
  bonus?: string;
}

const ToggleItem = ({ icon: Icon, label, sublabel, active, onToggle, bonus }: ToggleItemProps) => (
  <button
    onClick={() => { hapticSelection(); onToggle(); }}
    className={cn(
      "flex items-center gap-3 w-full rounded-xl border p-4 transition-all duration-200 text-left active:scale-[0.97]",
      active ? "border-gold/40 bg-gold/5" : "border-border bg-card hover:bg-secondary/50"
    )}
  >
    <div className={cn(
      "flex h-10 w-10 items-center justify-center rounded-lg shrink-0 transition-colors",
      active ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"
    )}>
      <Icon size={20} />
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn("font-semibold text-base", active && "text-gold")}>{label}</p>
      {sublabel && <p className="text-sm text-muted-foreground">{sublabel}</p>}
    </div>
    {bonus && active && (
      <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">{bonus}</span>
    )}
    <div className={cn(
      "h-5 w-5 rounded-full border-2 transition-all duration-200 shrink-0 flex items-center justify-center",
      active ? "border-gold bg-gold" : "border-muted-foreground/30"
    )}>
      {active && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
    </div>
  </button>
);

const SPORT_CATEGORIES = [
  { id: "none", label: "No workout", xp: 0, emoji: "—" },
  { id: "walk", label: "Walking / Light Cardio", xp: 10, emoji: "🚶" },
  { id: "run", label: "Running / Jogging", xp: 20, emoji: "🏃" },
  { id: "gym", label: "Gym / Weights", xp: 30, emoji: "🏋️" },
  { id: "swim", label: "Swimming", xp: 25, emoji: "🏊" },
  { id: "yoga", label: "Yoga / Stretching", xp: 15, emoji: "🧘" },
  { id: "combat", label: "Thai Boxing / MMA", xp: 35, emoji: "🥊" },
  { id: "hiit", label: "HIIT / CrossFit", xp: 30, emoji: "⚡" },
  { id: "team", label: "Team Sports", xp: 25, emoji: "⚽" },
  { id: "cycling", label: "Cycling", xp: 20, emoji: "🚴" },
  { id: "other", label: "Other Sport", xp: 20, emoji: "🏅" },
];

const DailyCheckin = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, isElite } = useAuth();
  const queryClient = useQueryClient();

  const { data: lastCheckin } = useQuery({
    queryKey: ["last-checkin", user?.id],
    staleTime: 5 * 60_000,   // 24h check-in window — 5 min stale is fine
    gcTime:    30 * 60_000,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("daily_checkins")
        .select("checked_in_at")
        .eq("user_id", user.id)
        .order("checked_in_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user,
  });

  // Recent sleep history (last 7 days) — used to detect chronic over-sleep
  const { data: recentSleep } = useQuery({
    queryKey: ["recent-sleep-7d", user?.id],
    staleTime: 10 * 60_000,
    gcTime:    30 * 60_000,
    queryFn: async () => {
      if (!user) return [] as number[];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("daily_checkins")
        .select("sleep_hours")
        .eq("user_id", user.id)
        .gte("checked_in_at", sevenDaysAgo);
      return (data || []).map((d) => Number(d.sleep_hours));
    },
    enabled: !!user,
  });

  // Calendar-day window (T2): one check-in per LOCAL day, matching the
  // server-side guard in record_checkin. toDateString() is local-time, so
  // this naturally respects the user's timezone with no drift.
  const canCheckin = !lastCheckin ||
    new Date(lastCheckin.checked_in_at).toDateString() !== new Date().toDateString();

  const getTimeUntilCheckin = () => {
    if (canCheckin) return null;
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0); // next local midnight
    const diff = tomorrow.getTime() - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const [sleep, setSleep] = useState(8);
  const [sportCategory, setSportCategory] = useState("none");
  const [sportOpen, setSportOpen] = useState(false);
  const [extraWorkout, setExtraWorkout] = useState(false);
  const [coldShower, setColdShower] = useState(false);
  const [healthyFood, setHealthyFood] = useState(false);
  const [protein, setProtein] = useState(false);
  const [meditationAm, setMeditationAm] = useState(false);
  const [meditationPm, setMeditationPm] = useState(false);
  const [hydration, setHydration] = useState(2);
  const [noPhoneAm, setNoPhoneAm] = useState(false);
  const [noPhonePm, setNoPhonePm] = useState(false);
  const [reading, setReading] = useState(false);
  const [journaling, setJournaling] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Wizard (B1 polish): 13 inputs split into 3 themed steps so the user
  // gets a sense of progress and the form stops feeling like an
  // endless wall. Step 1 = recovery, Step 2 = action, Step 3 = discipline
  // + proof + honesty + submit. All input state lives at this scope
  // so navigating Next/Back never loses values.
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Custom habits integration: each user's chosen long-game habits
  // (from /coach/habits) surface here as additional toggles in Step 3.
  // Toggling stores in local state; on submit we call logHabit() for
  // each one to update streaks + level via user_habits + user_habit_logs.
  const { habits: customHabits, completedTodaySet, logHabit } = useUserHabits();
  const [habitToggles, setHabitToggles] = useState<Record<string, boolean>>({});

  // Apple HealthKit — runs a sync after submit, then verifies the
  // check-in against HealthKit data. Verified check-ins earn the
  // "Verified Performer" badge. No-op on web / Android / pre-install.
  const healthKit = useHealthKit();
  const [unlockedBadge, setUnlockedBadge] = useState<any>(null);
  const [honest, setHonest] = useState<boolean | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [questBonusXp, setQuestBonusXp] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevelReached, setNewLevelReached] = useState(0);
  const [summary, setSummary] = useState<{
    xpEarned: number;
    newTotalXp: number;
    oldLevel: number;
    newLevel: number;
    xpToNextLevel: number;
    levelProgressPct: number;
    newStreak: number;
    streakBroken: boolean;
    completedCount: number;
    maxCount: number;
  } | null>(null);
  const moderation = useModeration();

  // Safe fallback to the first category ("none") if sportCategory is unrecognised —
  // avoids a crash from the non-null assertion when the value drifts.
  const selectedSport = SPORT_CATEGORIES.find((s) => s.id === sportCategory) ?? SPORT_CATEGORIES[0];;
  const workout = sportCategory !== "none";

  // Sleep quality logic — memoized so it only recalculates when sleep / recentSleep change.
  // - 7.5–9h is optimal
  // - 10–12h is good occasionally, but penalized if chronic (≥3 nights of 10h+ in last 7 days)
  // - 7h is sub-optimal (poor)
  // - <7h is poor / dangerous
  const { isOptimalSleep, isChronicOversleep, oversleepCount, sleepMultiplier, sleepPenaltyLabel } = useMemo(() => {
    const oversleepCount = (recentSleep || []).filter((h) => h >= 10).length;
    const chronic = oversleepCount >= 3;

    const optimal =
      (sleep >= 7.5 && sleep <= 9) ||
      (sleep > 9 && sleep <= 12 && !chronic);

    let multiplier = 1.0;
    if (sleep >= 7.5 && sleep <= 9) multiplier = 1.0;
    // Slightly-long sleep (9–12h): near-optimal occasionally, penalized only
    // when chronic. The `> 9` lower bound closes the old 9–10h gap that used
    // to fall through to the <5h branch and slap a 60% penalty on a 9.5h night.
    else if (sleep > 9 && sleep <= 12) multiplier = chronic ? 0.6 : 0.95;
    else if (sleep >= 7 && sleep < 7.5) multiplier = 0.8;
    else if (sleep >= 6 && sleep < 7) multiplier = 0.65;
    else if (sleep >= 5 && sleep < 6) multiplier = 0.5;
    else multiplier = 0.4; // <5h

    let penalty: string | null = null;
    if (multiplier < 1) {
      const pct = `${Math.round((1 - multiplier) * 100)}% XP penalty`;
      if (chronic && sleep > 9) penalty = `Chronic oversleep — ${pct}`;
      else if (sleep >= 7 && sleep < 7.5) penalty = `Sub-optimal sleep — ${pct}`;
      else if (sleep < 7) penalty = `Poor sleep — ${pct}`;
      else penalty = pct;
    }

    return { isOptimalSleep: optimal, isChronicOversleep: chronic, oversleepCount, sleepMultiplier: multiplier, sleepPenaltyLabel: penalty };
  }, [sleep, recentSleep]);

  const proofBonus = isElite && proofFile ? 30 : 0;
  const rawXp = [
    selectedSport.xp,
    extraWorkout && 25,
    coldShower && 30,
    healthyFood && 20,
    protein && 15,
    meditationAm && 15,
    meditationPm && 15,
    noPhoneAm && 20,
    noPhonePm && 20,
    hydration >= 3 && 20,
    isOptimalSleep && 25,
    reading && 20,
    journaling && 15,
    proofBonus,
  ].filter(Boolean).reduce((a: number, b) => a + (b as number), 0);

  const baseXp = Math.round(rawXp * sleepMultiplier);
  const totalXp = Math.round(isElite ? baseXp * ELITE_XP_MULTIPLIER : baseXp) + questBonusXp;

  // Reactive performance score
  const completedCount = [workout, extraWorkout, coldShower, healthyFood, protein, meditationAm, meditationPm, noPhoneAm, noPhonePm, hydration >= 3, isOptimalSleep, reading, journaling].filter(Boolean).length;
  const maxCount = 13;
  const perfPercent = Math.round((completedCount / maxCount) * 100);

  const getPerfLabel = () => {
    if (perfPercent >= 70) return { text: "Perfect Day 🔥", color: "text-gold", icon: Trophy, bg: "bg-gold/10 border-gold/30" };
    if (perfPercent >= 50) return { text: "Strong Execution 💪", color: "text-emerald-400", icon: TrendingUp, bg: "bg-emerald-500/10 border-emerald-500/30" };
    if (perfPercent >= 30) return { text: "Decent Day — Push Harder", color: "text-amber-400", icon: TrendingUp, bg: "bg-amber-500/10 border-amber-500/30" };
    return { text: "Low Output — Step Up", color: "text-destructive", icon: AlertTriangle, bg: "bg-destructive/10 border-destructive/30" };
  };

  const perf = getPerfLabel();

  const handleSubmit = async () => {
    if (!user || submitting || !canCheckin || honest !== true) return;
    hapticImpact("medium");
    setSubmitting(true);

    try {
      const checkinTimestamp = new Date().toISOString();

      // Upload proof photo if provided — moderate thumbnail FIRST, upload only on pass
      let proof_photo_url: string | null = null;
      if (proofFile && isElite) {
        const outcome = await moderation.moderateImage({
          file: proofFile,
          kind: "proof",
        });
        if (outcome.blocked) {
          toast.error(outcome.friendlyMessage ?? "Proof rejected");
          setSubmitting(false);
          return;
        }

        const ext = proofFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("proof-photos").upload(path, proofFile, {
          cacheControl: "3600",
          upsert: false,
        });
        if (uploadErr) throw new Error(`Photo upload failed: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage.from("proof-photos").getPublicUrl(path);
        proof_photo_url = urlData.publicUrl;
      }

      // Server-owned check-in (R1/T1/T2): one atomic RPC inserts the
      // daily_checkins row, enforces ONE check-in per local calendar day,
      // computes the streak server-side, and writes xp/level/streak. The
      // client can no longer spoof these — profile columns are DB-locked.
      const tzOffsetMinutes = new Date().getTimezoneOffset();
      const rpcArgs = {
        p_sleep_hours: sleep,
        p_workout: workout,
        p_extra_workout: extraWorkout,
        p_cold_shower: coldShower,
        p_healthy_food: healthyFood,
        p_protein_intake: protein,
        p_meditation_morning: meditationAm,
        p_meditation_evening: meditationPm,
        p_hydration_liters: hydration,
        p_no_phone_morning: noPhoneAm,
        p_no_phone_evening: noPhonePm,
        p_reading: reading,
        p_xp_earned: totalXp,
        p_proof_photo_url: proof_photo_url,
        p_journal_entry: journaling ? "logged" : null,
        p_tz_offset_minutes: tzOffsetMinutes,
      };

      // Transient mobile-network blips and access-token refresh races
      // occasionally fail the first call ("check your connection"). Retry a
      // couple of times with backoff, refreshing the session in between, before
      // giving up. record_checkin is idempotent per local calendar day
      // (ALREADY_CHECKED_IN_TODAY), so a retry after a lost response can never
      // create a duplicate check-in.
      let result: unknown = null;
      let rpcError: { message?: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const resp = await supabase.rpc("record_checkin", rpcArgs);
        result = resp.data;
        rpcError = resp.error;
        if (!rpcError) break;
        // A real "already done today" is terminal — don't retry it.
        if (rpcError.message?.includes("ALREADY_CHECKED_IN_TODAY")) break;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          // getSession() refreshes the access token if it expired mid-flight.
          await supabase.auth.getSession().catch(() => {});
        }
      }

      // R3: surface failures instead of silently losing the check-in. We keep
      // the wizard state on error so the user can retry with one tap.
      if (rpcError) {
        if (rpcError.message?.includes("ALREADY_CHECKED_IN_TODAY")) {
          toast.error("You've already checked in today. Come back tomorrow 💪");
          queryClient.invalidateQueries({ queryKey: ["last-checkin"] });
        } else {
          console.error("record_checkin failed after retries:", rpcError);
          toast.error("Couldn't save your check-in — check your connection and try again.", {
            description: rpcError.message ? `Details: ${rpcError.message}` : undefined,
            duration: 6000,
          });
        }
        hapticNotification("error");
        setSubmitting(false);
        return;
      }

      const r = result as {
        checkin_id: string;
        xp_earned: number;
        new_xp: number;
        old_level: number;
        new_level: number;
        old_streak: number;
        new_streak: number;
        streak_broken: boolean;
      };
      const newCheckinId = r.checkin_id;

      // HealthKit verification — fire-and-forget so a slow / failing sync
      // never blocks the celebration screen. Verified status is read back
      // on the next visit to the summary / profile.
      if (newCheckinId && healthKit.available) {
        healthKit.syncToday().then(async () => {
          try {
            const vr = await healthKit.verifyCheckin(newCheckinId);
            if (vr.verified) {
              toast.success("Verified Performer ✓", {
                description: "HealthKit confirmed your workout + sleep.",
                duration: 4500,
              });
            }
          } catch (err) {
            console.warn("verify_checkin failed", err);
          }
        }).catch((err) => console.warn("HK sync failed", err));
      }

      // Streak-broken warning
      if (r.streak_broken && r.old_streak > 0) {
        toast.error(`💀 Streak lost! Your ${r.old_streak}-day streak was reset.`, {
          duration: 5000,
        });
      }

      // Detect level-up
      if (r.new_level > r.old_level) {
        setNewLevelReached(r.new_level);
        setShowLevelUp(true);
      }

      await syncStreakWarningNotification({
        lastCheckinAt: checkinTimestamp,
        streak: r.new_streak,
      });

      // Auto-update status tier based on percentile
      await supabase.rpc("update_status_tier", { target_user_id: user.id });

      // Capture summary for the post-submit recap card
      const xpIntoLevel = r.new_xp - (r.new_level - 1) * 500;
      setSummary({
        xpEarned: r.xp_earned,
        newTotalXp: r.new_xp,
        oldLevel: r.old_level,
        newLevel: r.new_level,
        xpToNextLevel: 500 - xpIntoLevel,
        levelProgressPct: Math.round((xpIntoLevel / 500) * 100),
        newStreak: r.new_streak,
        streakBroken: r.streak_broken && r.old_streak > 0,
        completedCount,
        maxCount,
      });

      // Check and award ALL applicable badges (streak, XP, level, checkins, workouts, etc.)
      const newBadge = await checkAndAwardBadges(user.id);
      if (newBadge?.isNew) {
        setUnlockedBadge(newBadge.badge);
      }

      // "Your tribes felt it 🔥" — fire a celebratory toast if user belongs
      // to ≥1 tribe. The realtime reactor on every tribe page picks up this
      // streak bump and pulses the collective flame for every other member.
      try {
        const { count: tribeCount } = await supabase
          .from("tribe_members" as any)
          .select("tribe_id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "active");
        if ((tribeCount ?? 0) > 0) {
          const flameMsg = (tribeCount ?? 0) === 1
            ? "Your tribe felt it 🔥"
            : `Your ${tribeCount} tribes felt it 🔥`;
          toast.success(flameMsg, {
            description: `+1 day → collective fire just grew`,
            duration: 4500,
          });
        }
      } catch {
        // non-critical — silent
      }

      // Log each toggled-on custom habit. Sequential (the list is ≤8) so
      // per-habit XP + streak bumps settle before refreshProfile() below.
      // Errors are swallowed per-habit so one bad row can't sink submit.
      const toggledHabitIds = Object.entries(habitToggles)
        .filter(([, v]) => v)
        .map(([id]) => id);
      for (const habitId of toggledHabitIds) {
        try {
          await logHabit(habitId);
        } catch (err) {
          console.error("logHabit failed", habitId, err);
        }
      }

      // Elite: auto-post proof photo to feed
      if (isElite && proof_photo_url) {
        const sportLabel = selectedSport.id !== "none" ? `${selectedSport.emoji} ${selectedSport.label}` : null;
        const content = sportLabel
          ? `Daily check-in ✅ ${sportLabel} — ${totalXp} XP earned 🔥`
          : `Daily check-in ✅ — ${totalXp} XP earned 🔥`;
        await supabase.from("feed_posts").insert({
          user_id: user.id,
          content,
          image_url: proof_photo_url,
        });
      }

      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["last-checkin"] });
      queryClient.invalidateQueries({ queryKey: ["user-badges"] });
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      hapticNotification("success");
      triggerGust(0.95);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong saving your check-in. Please try again.", {
        duration: 5000,
      });
      hapticNotification("error");
    }
    setSubmitting(false);
  };

  // Daily lock screen
  if (!canCheckin && !submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center pb-4">
        <div className="animate-reveal">
          <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
            <Moon size={36} className="text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight mb-2">Already Logged Today</h1>
          <p className="text-muted-foreground text-sm mb-2">You can only check in once per day.</p>
          <p className="text-gold font-display text-lg font-bold mb-8">
            Next check-in in {getTimeUntilCheckin()}
          </p>
          <Button variant="gold-outline" size="lg" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <>
        {showLevelUp && <LevelUpCelebration newLevel={newLevelReached} onComplete={() => setShowLevelUp(false)} />}
        <BadgeUnlockModal badge={unlockedBadge} onClose={() => setUnlockedBadge(null)} />
        <ConfettiBurst active={submitted} />
        {summary && (
          <CheckinTierSummary
            tier={profile?.status_tier ?? "recruit"}
            summary={summary}
            onProfile={() => navigate("/profile")}
            onDashboard={() => navigate("/")}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen pb-4 px-4 pt-0 safe-top">
      <ModerationGate
        state={moderation.state}
        message={moderation.message}
        thumbnailUrl={proofPreview}
        onCancel={moderation.cancel}
        onDismiss={moderation.reset}
      />
      {/* Bold tier-specific sticky header */}
      <CheckinTierHeader
        tier={profile?.status_tier ?? "recruit"}
        username={profile?.username}
        streak={profile?.streak ?? 0}
        totalXp={totalXp}
        isElite={isElite}
        completedCount={completedCount}
        maxCount={maxCount}
        onBack={() => navigate("/")}
      />

      {/* Wizard progress indicator */}
      <div className="mt-3 mb-4 flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              step >= (n as 1 | 2 | 3) ? "bg-gold" : "bg-border",
            )}
          />
        ))}
        <span className="ml-2 text-[10px] font-bold tracking-wider uppercase text-muted-foreground tabular-nums">
          {step} / 3
        </span>
      </div>

      {/* ═══════════════════════════ STEP 1 — RECOVERY ═══════════════════════════ */}
      {step === 1 && (<>
      <p className="mb-3 text-[11px] font-black tracking-[0.18em] uppercase text-gold/80">Recovery</p>

      {/* Sleep */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-border bg-card p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Moon size={20} /></div>
          <div>
            <p className="font-semibold text-sm">Sleep</p>
            <p className="text-xs text-muted-foreground">Optimal: 7.5–9 hours</p>
          </div>
          <span className={cn(
            "ml-auto text-2xl font-bold font-display tabular-nums",
            isOptimalSleep ? "text-gold" : sleep <= 5 ? "text-destructive" : "text-muted-foreground"
          )}>
            {sleep}h {sleep >= 7.5 && sleep <= 9 ? "🚀" : (sleep > 9 && sleep <= 12 && !isChronicOversleep) ? "✨" : sleep >= 7 && sleep < 7.5 ? "😐" : sleep <= 5 ? "💀" : sleep > 9 ? "😴" : "⚠️"}
          </span>
        </div>
        <input type="range" min={4} max={12} step={0.5} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} className="w-full accent-[hsl(var(--gold))] h-1.5" />
        {sleepPenaltyLabel && (
          <p className="text-[10px] text-destructive mt-1 font-semibold">⚠️ {sleepPenaltyLabel}</p>
        )}
        {isChronicOversleep && sleep >= 10 && (
          <p className="text-[10px] text-muted-foreground mt-1">You've slept 10h+ {oversleepCount} of the last 7 nights — occasional long nights help, chronic oversleep hurts.</p>
        )}
      </div>

      {/* Hydration */}
      <div className="animate-reveal animate-reveal-delay-1 rounded-xl border border-border bg-card p-4 mb-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/10 text-teal"><Droplets size={20} /></div>
          <div><p className="font-semibold text-sm">Hydration</p><p className="text-xs text-muted-foreground">Target: 3L+</p></div>
          <span className={cn("ml-auto text-2xl font-bold font-display tabular-nums", hydration >= 3 ? "text-gold" : "text-muted-foreground")}>{hydration}L</span>
        </div>
        <input type="range" min={0} max={5} step={0.5} value={hydration} onChange={(e) => setHydration(Number(e.target.value))} className="w-full accent-[hsl(var(--gold))] h-1.5" />
      </div>

      {/* Recovery toggles — meditation morning + evening */}
      <div className="space-y-2.5 animate-reveal animate-reveal-delay-2 mb-3">
        <ToggleItem icon={Brain} label="Morning Meditation" sublabel="Start the day focused" active={meditationAm} onToggle={() => setMeditationAm(!meditationAm)} bonus="+15 XP" />
        <ToggleItem icon={Brain} label="Evening Meditation" sublabel="Reflect and wind down" active={meditationPm} onToggle={() => setMeditationPm(!meditationPm)} bonus="+15 XP" />
      </div>
      </>)}

      {/* ═══════════════════════════ STEP 2 — ACTION ═══════════════════════════ */}
      {step === 2 && (<>
      <p className="mb-3 text-[11px] font-black tracking-[0.18em] uppercase text-gold/80">Action</p>

      {/* Sport Category Selector */}
      <div className="animate-reveal animate-reveal-delay-2 mb-2.5">
        <button
          onClick={() => setSportOpen(!sportOpen)}
          className={cn(
            "flex items-center gap-3 w-full rounded-xl border p-4 transition-all duration-200 text-left active:scale-[0.97]",
            workout ? "border-gold/40 bg-gold/5" : "border-border bg-card hover:bg-secondary/50"
          )}
        >
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg shrink-0 transition-colors",
            workout ? "bg-gold/15 text-gold" : "bg-secondary text-muted-foreground"
          )}>
            <Dumbbell size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("font-semibold text-sm", workout && "text-gold")}>
              {workout ? `${selectedSport.emoji} ${selectedSport.label}` : "Select Workout"}
            </p>
            <p className="text-xs text-muted-foreground">Choose your sport category</p>
          </div>
          {workout && (
            <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">+{selectedSport.xp} XP</span>
          )}
          <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", sportOpen && "rotate-180")} />
        </button>

        {sportOpen && (
          <div className="mt-1 rounded-xl border border-border bg-card overflow-hidden">
            {SPORT_CATEGORIES.filter((s) => s.id !== "none").map((sport) => (
              <button
                key={sport.id}
                onClick={() => {
                  setSportCategory(sport.id);
                  setSportOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 text-left transition-colors border-b border-border last:border-0 active:scale-[0.98]",
                  sportCategory === sport.id ? "bg-gold/5" : "hover:bg-secondary/50"
                )}
              >
                <span className="text-lg w-7 text-center">{sport.emoji}</span>
                <span className="text-sm font-medium flex-1">{sport.label}</span>
                <span className="text-xs font-bold text-gold">+{sport.xp} XP</span>
              </button>
            ))}
            {sportCategory !== "none" && (
              <button
                onClick={() => { setSportCategory("none"); setSportOpen(false); }}
                className="flex items-center gap-3 w-full px-4 py-3 text-left text-muted-foreground hover:bg-secondary/50 transition-colors"
              >
                <span className="text-lg w-7 text-center">✗</span>
                <span className="text-sm font-medium">Clear selection</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action toggles */}
      <div className="space-y-2.5 animate-reveal animate-reveal-delay-2 mb-3">
        <ToggleItem icon={Plus} label="Extra Workout" sublabel="Second session today" active={extraWorkout} onToggle={() => setExtraWorkout(!extraWorkout)} bonus="+25 XP" />
        <ToggleItem icon={Snowflake} label="Cold Shower" sublabel="Build mental toughness" active={coldShower} onToggle={() => setColdShower(!coldShower)} bonus="+30 XP" />
        <ToggleItem icon={Smartphone} label="No Phone After Waking" sublabel="30 min screen-free" active={noPhoneAm} onToggle={() => setNoPhoneAm(!noPhoneAm)} bonus="+20 XP" />
        <ToggleItem icon={Smartphone} label="No Phone Before Sleep" sublabel="30 min screen-free" active={noPhonePm} onToggle={() => setNoPhonePm(!noPhonePm)} bonus="+20 XP" />
      </div>
      </>)}

      {/* ═══════════════════════════ STEP 3 — DISCIPLINE + SUBMIT ═══════════════════════════ */}
      {step === 3 && (<>
      <p className="mb-3 text-[11px] font-black tracking-[0.18em] uppercase text-gold/80">Discipline</p>

      {/* Discipline toggles */}
      <div className="space-y-2.5 animate-reveal animate-reveal-delay-2 mb-3">
        <ToggleItem icon={Apple} label="Healthy Food" sublabel="Clean meals all day" active={healthyFood} onToggle={() => setHealthyFood(!healthyFood)} bonus="+20 XP" />
        <ToggleItem icon={Apple} label="Protein Intake" sublabel="Hit your protein target" active={protein} onToggle={() => setProtein(!protein)} bonus="+15 XP" />
        <ToggleItem icon={BookOpen} label="Read / Learn Something New" sublabel="Books, articles, courses" active={reading} onToggle={() => setReading(!reading)} bonus="+20 XP" />
        <ToggleItem icon={NotebookPen} label="Journaling" sublabel="Reflect on wins, lessons, next steps" active={journaling} onToggle={() => setJournaling(!journaling)} bonus="+15 XP" />
      </div>

      {/* Custom habits — long-game protocols each user picks in Coach.
          Active habits surface here as additional toggles. Already-logged
          today habits start checked + disabled. Submitting fires logHabit
          per toggled habit so per-habit streaks + XP roll up alongside the
          fixed 13-toggle set, instead of forcing a bounce to another page. */}
      <div className="mt-4 animate-reveal animate-reveal-delay-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-black tracking-[0.18em] uppercase text-gold/80">Your habits</p>
          {customHabits.length > 0 && (
            <button
              onClick={() => navigate("/coach/habits")}
              className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-gold transition-colors"
            >
              Edit
            </button>
          )}
        </div>
        {customHabits.length === 0 ? (
          <button
            onClick={() => navigate("/coach/habits")}
            className="flex items-center gap-3 w-full rounded-xl border border-dashed border-gold/30 p-4 hover:bg-gold/5 transition-colors active:scale-[0.97] text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold">
              <Plus size={20} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Pick your habits</p>
              <p className="text-xs text-muted-foreground">Build a custom set in Coach — they show up here every day.</p>
            </div>
          </button>
        ) : (
          <div className="space-y-2.5">
            {customHabits.map((h) => {
              const protocol = PROTOCOLS.find((p) => p.id === h.protocol_id);
              const title = protocol?.title ?? h.protocol_id;
              const alreadyLogged = completedTodaySet.has(h.id);
              const checked = alreadyLogged || !!habitToggles[h.id];
              return (
                <ToggleItem
                  key={h.id}
                  icon={Zap}
                  label={title}
                  sublabel={
                    alreadyLogged
                      ? `Already logged today · ${h.current_streak}d streak`
                      : `${h.current_streak}d streak · Lv ${h.level}`
                  }
                  active={checked}
                  onToggle={() => {
                    if (alreadyLogged) return;
                    setHabitToggles((prev) => ({ ...prev, [h.id]: !prev[h.id] }));
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Daily Quests */}
      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        <DailyQuests
          checkinData={{
            sleep,
            sportCategory,
            extraWorkout,
            coldShower,
            healthyFood,
            protein,
            meditationAm,
            meditationPm,
            hydration,
            noPhoneAm,
            noPhonePm,
            reading,
            completedCount,
          }}
          onBonusXpChange={setQuestBonusXp}
        />
      </div>

      {/* Proof Photo — Elite only */}
      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        {isElite ? (
          <div>
            <label className="flex items-center gap-3 w-full rounded-xl border border-dashed border-gold/30 p-4 hover:bg-gold/5 transition-colors active:scale-[0.97] cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10 text-gold"><Camera size={20} /></div>
              <div className="text-left flex-1">
                <p className="font-semibold text-sm">Upload Proof Photo</p>
                <p className="text-xs text-muted-foreground">Elite perk — earns <span className="text-gold font-bold">+30 bonus XP</span></p>
              </div>
              {proofFile && <span className="text-[10px] font-bold text-gold bg-gold/10 px-2 py-0.5 rounded-full">+30 XP</span>}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fileAge = Date.now() - file.lastModified;
                if (fileAge > 5 * 60 * 1000) {
                  toast.error("Please take a fresh photo right now. Gallery photos are not allowed.");
                  e.target.value = "";
                  return;
                }
                setProofFile(file);
                const reader = new FileReader();
                reader.onload = () => setProofPreview(reader.result as string);
                reader.readAsDataURL(file);
              }} />
            </label>
            {proofPreview && (
              <div className="relative mt-2 rounded-xl overflow-hidden">
                <img loading="lazy" decoding="async" src={proofPreview} alt="Proof" className="w-full max-h-40 object-cover rounded-xl" />
                <button
                  onClick={() => { setProofFile(null); setProofPreview(null); }}
                  className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 w-full rounded-xl border border-dashed border-border p-4 opacity-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Camera size={20} /></div>
            <div className="text-left">
              <p className="font-semibold text-sm">Upload Proof Photo</p>
              <p className="text-xs text-muted-foreground">Elite feature — unlock to use</p>
            </div>
            <Crown size={16} className="ml-auto text-gold" />
          </div>
        )}
      </div>

      <div className="mt-4 animate-reveal animate-reveal-delay-3">
        <div className={cn("rounded-xl border p-4 transition-all duration-300", perf.bg)}>
          <div className="flex items-center gap-3 mb-2">
            <perf.icon size={20} className={perf.color} />
            <p className={cn("font-display font-bold text-sm", perf.color)}>{perf.text}</p>
            <span className={cn("ml-auto font-display font-black text-lg tabular-nums", perf.color)}>{perfPercent}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500",
                perfPercent === 100 ? "bg-gold" : perfPercent >= 80 ? "bg-teal" : perfPercent >= 50 ? "bg-amber" : "bg-destructive"
              )}
              style={{ width: `${perfPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">{completedCount}/{maxCount} tasks completed</p>
        </div>
      </div>

      {/* Honesty check */}
      <div className="mt-4 animate-reveal animate-reveal-delay-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-semibold text-sm mb-3">Were you honest? 🤝</p>
          <p className="text-xs text-muted-foreground mb-3">Answer truthfully — you can't grind with lies.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setHonest(true)}
              className={cn(
                "flex-1 rounded-xl border p-3 text-sm font-bold transition-all active:scale-[0.97]",
                honest === true
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              Yes ✅
            </button>
            <button
              onClick={() => setHonest(false)}
              className={cn(
                "flex-1 rounded-xl border p-3 text-sm font-bold transition-all active:scale-[0.97]",
                honest === false
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              No ❌
            </button>
          </div>
          {honest === false && (
            <p className="text-xs text-destructive mt-2">Be honest with yourself. Go back and fix your answers.</p>
          )}
        </div>
      </div>

      {/* Submit — only on the last step */}
      <div className="mt-6 animate-reveal animate-reveal-delay-4">
        <Button variant="ember" size="xl" className="w-full" onClick={handleSubmit} disabled={submitting || honest !== true}>
          <Zap size={20} />
          {submitting ? "Submitting..." : `Submit Day — Earn ${totalXp} XP`}
        </Button>
      </div>
      </>)}

      {/* ═══════════════════════════ WIZARD NAVIGATION ═══════════════════════════ */}
      {/* Back / Next buttons. Step 3's primary action is Submit (above), so
          Next is hidden there; Back is hidden on Step 1. */}
      <div className="mt-4 flex gap-3">
        {step > 1 && (
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
          >
            ← Back
          </Button>
        )}
        {step < 3 && (
          <Button
            variant="ember"
            size="lg"
            className="flex-1"
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
          >
            Next →
          </Button>
        )}
      </div>
    </div>
  );
};

export default DailyCheckin;
